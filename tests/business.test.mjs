import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_PRICE_PER_DAY_CENTS, businessRedirect, safeBusinessUrl, validateBusinessCampaign, validateBusinessProfile } from "../functions/_lib/business-core.js";
import { processCampaigns } from "../business-automation/src/index.js";

test("business pricing is calculated server-side",()=>{
  const result=validateBusinessCampaign({campaignType:"sponsored_distribution",contentType:"innovation",title:"Une campagne TAMUSNI",shortDescription:"Une présentation suffisamment précise.",detailedDescription:"Une description détaillée, factuelle et assez longue pour permettre une validation éditoriale correcte.",destinationUrl:"https://example.com/offer",industry:"Technology",objective:"Faire connaître une innovation",audience:["Décideurs"],countries:["MA"],languages:["fr"],durationDays:12,startMode:"immediate"});
  assert.equal(result.ok,true);assert.equal(result.campaign.priceCents,12*BUSINESS_PRICE_PER_DAY_CENTS);assert.equal(result.campaign.currency,"EUR");
});

test("unsafe or internal business URLs are rejected",()=>{
  assert.equal(safeBusinessUrl("http://example.com"),null);
  assert.equal(safeBusinessUrl("https://localhost/test"),null);
  assert.equal(safeBusinessUrl("https://192.168.1.2/test"),null);
  assert.equal(safeBusinessUrl("https://example.com/test"),"https://example.com/test");
});

test("business profile requires a real professional record",()=>{
  const result=validateBusinessProfile({legalName:"A&B Technologies",tradingName:"TAMUSNI",description:"Une entreprise technologique avec une description professionnelle suffisamment complète.",industry:"Technology",country:"Morocco",websiteUrl:"https://tamusni.science",professionalEmail:"aetbconseil@gmail.com",contactName:"TAMUSNI",contactRole:"Direction"});
  assert.equal(result.ok,true);
});

test("role redirection is localized",()=>{
  assert.equal(businessRedirect("BUSINESS","ar"),"/ar/business/espace/");
  assert.equal(businessRedirect("ADMIN","fr"),"/fr/admin/");
});

test("business scheduler activates, completes and consolidates independently",async()=>{
  const statements=[];
  const db={
    prepare(sql){return{sql,bind(...bindings){return{sql,bindings,async all(){if(sql.includes("status='scheduled'"))return{results:[{id:"due",duration_days:3}]};if(sql.includes("status='active'"))return{results:[{id:"expired"}]};return{results:[]};}}}};},
    async batch(items){statements.push(...items);}
  };
  const result=await processCampaigns({DB:db},new Date("2026-10-25T06:00:00.000Z"));
  assert.equal(result.activated,1);assert.equal(result.completed,1);
  assert.ok(statements.some((item)=>item.sql.includes("SET status='active'")));
  assert.ok(statements.some((item)=>item.sql.includes("SET status='completed'")));
  assert.ok(statements.some((item)=>item.sql.includes("impressions_consolidated=impressions_provisional")));
});
