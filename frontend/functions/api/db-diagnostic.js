const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({ok:false,error:"DB missing"},503);
    const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const hasProducts=tables.results.some((row)=>row.name==="products");
    const columns=hasProducts?await env.DB.prepare("PRAGMA table_info(products)").all():{results:[]};
    return json({ok:true,tables:tables.results.map((row)=>row.name),productColumns:columns.results.map((row)=>row.name)});
  }catch(cause){
    return json({ok:false,error:String(cause&&cause.message||cause)},500);
  }
}
