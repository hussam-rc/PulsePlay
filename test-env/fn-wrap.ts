const orig = Deno.serve.bind(Deno);
(Deno as any).serve = (h: any) => orig({ port: Number(Deno.env.get('PORT')) }, h);
await import(Deno.env.get('FN')!);
