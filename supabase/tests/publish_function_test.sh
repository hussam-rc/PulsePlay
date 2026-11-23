#!/usr/bin/env bash
# End-to-end test of the publish Edge Function. Needs: local DB with migrations, fn-server (8790) and the function (8000).
set -u
F=${FN_URL:-http://localhost:8000}; API=${API_URL:-http://localhost:8790}
A=00000000-0000-0000-0000-0000000000a1; C=00000000-0000-0000-0000-0000000000c1; D=00000000-0000-0000-0000-0000000000d1; B=00000000-0000-0000-0000-0000000000b1
psql -q -At -c "insert into auth.users(id,email) values ('$A','a1@example.org'),('$C','c1@example.org'),('$D','d1@example.org'),('$B','b1@example.org') on conflict do nothing" >/dev/null
pass=0; fail=0; ok() { if [ "$1" = "1" ]; then echo "PASS $2"; pass=$((pass+1)); else echo "FAIL $2   [${3:-}]"; fail=$((fail+1)); fi; }
rpc() { curl -s -X POST "$API/rest/v1/rpc/$1" -H "authorization: Bearer $2" -H 'content-type: application/json' -d "$3"; }
pub() { curl -s -o /tmp/pub.json -w "%{http_code}" -X POST "$F" -H "origin: https://hussam-rc.github.io" ${1:+-H "authorization: Bearer $1"} -H 'content-type: application/json' -d "$2"; }
ORG=$(rpc pp_create_org "user:$A:a1@example.org" '{"p_name":"Publish Org"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
rpc pp_invite "user:$A:a1@example.org" "{\"p_org\":\"$ORG\",\"p_email\":\"c1@example.org\",\"p_role\":\"creator\"}" >/dev/null
rpc pp_invite "user:$A:a1@example.org" "{\"p_org\":\"$ORG\",\"p_email\":\"d1@example.org\",\"p_role\":\"facilitator\"}" >/dev/null
rpc pp_accept_invites "user:$C:c1@example.org" '{}' >/dev/null; rpc pp_accept_invites "user:$D:d1@example.org" '{}' >/dev/null
EXP=$(rpc pp_copy_template "user:$C:c1@example.org" "{\"p_slug\":\"would-you-rather\",\"p_org\":\"$ORG\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
code=$(pub "" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 401 ] && echo 1)" "signed-out request refused (401)" "$code"
code=$(pub "user:$D:d1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 403 ] && echo 1)" "facilitator cannot publish (403)" "$code $(cat /tmp/pub.json)"
code=$(pub "user:$B:b1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 403 ] && echo 1)" "outsider cannot publish (403)" "$code"
# break the draft: overlapping result bands are impossible for polls, so remove all activities instead
DRAFT=$(rpc pp_get_experience "user:$C:c1@example.org" "{\"p_id\":\"$EXP\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin)["draft"];d["rounds"]=[];print(json.dumps(d))')
rpc pp_save_draft "user:$C:c1@example.org" "{\"p_id\":\"$EXP\",\"p_org\":\"$ORG\",\"p_title\":\"Broken\",\"p_draft\":$DRAFT}" >/dev/null
code=$(pub "user:$C:c1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 422 ] && grep -q rounds /tmp/pub.json && echo 1)" "invalid draft rejected by server-side validation (422)" "$code $(cat /tmp/pub.json)"
GOOD=$(psql -q -At -c "select v.content from pp.experience_versions v join pp.experiences e on e.id=v.experience_id where e.slug='would-you-rather'" | python3 -c 'import sys,json;d=json.load(sys.stdin);d["id"]="team-dilemmas";d["title"]="Team Dilemmas";d["status"]="draft";d["rounds"][0]["activities"]=d["rounds"][0]["activities"][:3];print(json.dumps(d))')
rpc pp_save_draft "user:$C:c1@example.org" "{\"p_id\":\"$EXP\",\"p_org\":\"$ORG\",\"p_title\":\"Team Dilemmas\",\"p_draft\":$GOOD}" >/dev/null
code=$(pub "user:$C:c1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"public\"}"); ok "$([ "$code" = 400 ] && grep -q "platform review" /tmp/pub.json && echo 1)" "public listing refused (needs platform review)" "$code $(cat /tmp/pub.json)"
code=$(pub "user:$C:c1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 200 ] && grep -q '"version":1' /tmp/pub.json && echo 1)" "creator publishes version 1 to the organisation" "$code $(cat /tmp/pub.json)"
ok "$(psql -q -At -c "select (status='published' and visibility='org')::int from pp.experiences where id='$EXP'")" "experience now published, organisation-only" ""
ok "$(psql -q -At -c "select (content->>'status'='published' and jsonb_array_length(content->'rounds'->0->'activities')=3)::int from pp.experience_versions where experience_id='$EXP' and version=1")" "stored version is the validated content" ""
code=$(pub "user:$C:c1@example.org" "{\"experienceId\":\"$EXP\",\"visibility\":\"org\"}"); ok "$([ "$code" = 200 ] && grep -q '"version":2' /tmp/pub.json && echo 1)" "republishing creates version 2 (version 1 untouched)" "$code"
S=$(rpc pp_create_session "user:$D:d1@example.org" "{\"p_experience\":\"$EXP\",\"p_settings\":{}}"); ok "$(echo "$S" | grep -q '"code"' && echo 1)" "facilitator hosts the newly published org game" "$S"
S=$(rpc pp_create_session "user:$B:b1@example.org" "{\"p_experience\":\"$EXP\",\"p_settings\":{}}"); ok "$(echo "$S" | grep -q 'experience not found' && echo 1)" "outsider cannot host it" "$S"
H=$(curl -s -D - -o /dev/null -X OPTIONS "$F" -H "origin: https://hussam-rc.github.io" | grep -i "access-control-allow-origin" | tr -d '\r'); ok "$(echo "$H" | grep -q "https://hussam-rc.github.io" && echo 1)" "CORS allows the GitHub Pages origin" "$H"
H=$(curl -s -D - -o /dev/null -X OPTIONS "$F" -H "origin: https://evil.example" | grep -i "access-control-allow-origin" | tr -d '\r'); ok "$(echo "$H" | grep -vq "evil" && echo 1)" "CORS does not echo other origins" "$H"
psql -q -c "delete from pp.sessions; delete from pp.organisations where name='Publish Org'; delete from pp.audit_events; delete from auth.users where email like '%1@example.org'" >/dev/null
echo "$pass passed, $fail failed"; [ $fail = 0 ]
