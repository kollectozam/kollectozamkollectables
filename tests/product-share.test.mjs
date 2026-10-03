import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet} from "../frontend/functions/p/[[reference]].js";

function database(product){
  return {prepare(sql){
    assert.match(sql,/WHERE reference=\?/);
    return {bind(reference){return {first:async()=>reference===product?.reference?product:null}}};
  }};
}

const product={reference:"KZ-025",name:"Groudon AR",category:"Singles",setName:"Storm Emerald",cardNumber:"084/076",language:"Japanese",condition:"Near Mint",notes:"Clean copy",price:25,quantity:1,status:"available",frontImageUrl:"https://example.com/groudon.jpg",backImageUrl:null};

test("renders card-specific metadata and WhatsApp actions",async()=>{
  const response=await onRequestGet({request:new Request("https://cards.example/p/KZ-025"),env:{DB:database(product)},params:{reference:"KZ-025"}});
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/property="og:title" content="Groudon AR — BND \$25 \| Kollectozam"/);
  assert.match(html,/property="og:image" content="https:\/\/example.com\/groudon.jpg"/);
  assert.match(html,/https:\/\/wa\.me\/\?text=/);
  assert.match(html,/https:\/\/wa\.me\/6737409444\?text=/);
  assert.match(html,/data-copy/);
});

test("keeps unavailable listings readable without a claim action",async()=>{
  const response=await onRequestGet({request:new Request("https://cards.example/p/KZ-025"),env:{DB:database({...product,status:"sold"})},params:{reference:"KZ-025"}});
  const html=await response.text();
  assert.match(html,/No longer available/);
  assert.doesNotMatch(html,/Claim on WhatsApp/);
  assert.match(html,/Browse available cards/);
});

test("returns a useful 404 page for an unknown reference",async()=>{
  const response=await onRequestGet({request:new Request("https://cards.example/p/KZ-999"),env:{DB:database(product)},params:{reference:"KZ-999"}});
  assert.equal(response.status,404);
  assert.match(await response.text(),/Listing unavailable/);
});

test("escapes card data before placing it in HTML metadata",async()=>{
  const unsafe={...product,name:'Mew <script>alert("x")</script>'};
  const response=await onRequestGet({request:new Request("https://cards.example/p/KZ-025"),env:{DB:database(unsafe)},params:{reference:"KZ-025"}});
  const html=await response.text();
  assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/Mew &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});
