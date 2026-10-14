(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.PerkCore;
  const categories={aircanada:'Air Canada',travel:'其他旅行',chase_travel:'Chase Travel',dining:'餐饮',grocery:'实体超市',online_grocery:'线上超市',grocery_dining:'超市 / 餐饮（未拆分）',online_shopping:'网购',drugstore:'药店',gas:'加油 / EV',streaming:'流媒体',vacation_rental:'度假住宿',wholesale:'仓储店',tuition:'学费',other:'其他消费',unclassified:'待分类'};
  function within(r,year,today){if(r.date)return r.date<=today&&(year==='all'||r.date.slice(0,4)===String(year));if(r.periodStart&&r.periodStart>today)return false;const y=r.periodYear||Number((r.periodStart||'').slice(0,4));return Number.isInteger(y)&&y<=Number(today.slice(0,4))&&(year==='all'||y===Number(year));}
  function value(data,program,points){const cpp=data.settings.valuations[program];return {amount:(points||0)*(cpp||0)/100,missing:cpp==null};}
  function report(data,year='all',today=C.localDate()){
    const base=C.summary(data,year,today),cards=data.cards.map(c=>({id:c.id,name:C.cardState(data,c,today).name,spend:0,perks:0,sub:0,other:0,spendGross:0,perkGross:0,subGross:0,spendCosts:0,perkCosts:0,subCosts:0,total:0,estimated:0,pendingSubPoints:(c.subMilestones||[]).filter(m=>m.status!=='received').reduce((n,m)=>n+(m.points||0),0)}));
    const unassigned={id:'unassigned',name:'未归属卡片',spend:0,perks:0,sub:0,other:0,spendGross:0,perkGross:0,subGross:0,spendCosts:0,perkCosts:0,subCosts:0,total:0,estimated:0,pendingSubPoints:0};
    const row=id=>cards.find(c=>c.id===id)||unassigned;const byCategory=Object.create(null);let nonCard=0,unclassified=0;const missing=new Set();
    for(const p of data.points.filter(p=>within(p,year,today))){
      if(!['earn','cashback','adjust-in','adjust-out'].includes(p.type))continue;
      const bucket=p.incomeBucket||(p.source==='card-spend'?'spend':p.source==='flight'?'flight':'unclassified');
      const v=p.type==='cashback'?{amount:p.amount,missing:false}:value(data,p.program,p.amount);if(p.type==='adjust-out')v.amount=-v.amount;if(v.missing)missing.add(p.program);
      if(bucket==='flight'){nonCard+=v.amount;continue;}if(bucket==='unclassified'){unclassified+=v.amount;continue;}
      if(!['spend','perk','sub','other'].includes(bucket)){unclassified+=v.amount;continue;}
      const r=row(p.cardId);r[bucket==='perk'?'perks':bucket]+=v.amount;if(bucket==='spend')r.spendGross+=v.amount;if(bucket==='perk')r.perkGross+=v.amount;if(bucket==='sub')r.subGross+=v.amount;if(p.amountEstimated)r.estimated+=v.amount;
      if(bucket==='spend'){const category=p.category||'unclassified';const map=byCategory[category]||(byCategory[category]={value:0,cash:0,points:Object.create(null),spend:0,cards:Object.create(null)});map.value+=v.amount;if(p.type==='cashback')map.cash+=p.amount;else map.points[p.program]=(map.points[p.program]||0)+(p.type==='adjust-out'?-p.amount:p.amount);map.spend+=p.spendAmount||0;map.cards[r.id]=(map.cards[r.id]||0)+v.amount;}
    }
    for(const u of data.usages.filter(u=>within(u,year,today))){const p=data.perks.find(p=>p.id===u.perkId);if(!p)continue;const r=row(p.cardId);const v=u.actualValue||0;r.perks+=v;r.perkGross+=v;if(u.valueStatus==='estimated')r.estimated+=v;}
    for(const cost of data.costs.filter(c=>within(c,year,today))){if(cost.bankId)continue;const bucket=cost.bucket||'perk',r=row(cost.cardId),v=cost.amount||0;if(bucket==='sub'){r.sub-=v;r.subCosts+=v;}else if(bucket==='spend'){r.spend-=v;r.spendCosts+=v;}else if(bucket==='perk'){r.perks-=v;r.perkCosts+=v;}else r.other-=v;if(cost.amountConfirmed===false)r.estimated+=v;}
    const hasSub=cardId=>data.points.some(p=>p.cardId===cardId&&p.incomeBucket==='sub'&&['earn','cashback'].includes(p.type));
    for(const c of data.cards){if(c.subStatus!=='received')continue;const r=row(c.id);if(!hasSub(c.id)&&(c.subCash!=null||c.subCashEstimate!=null)){
      const y=c.subReceiptYear;if((year==='all'&&!y||(year==='all'||Number(year)===y)&&y<=Number(today.slice(0,4)))){const amount=c.subCash??c.subCashEstimate;r.sub+=amount;r.subGross+=amount;if(c.subCash==null)r.estimated+=amount;}
    }}
    if(Object.values(unassigned).some((v)=>typeof v==='number'&&v!==0))cards.push(unassigned);
    for(const r of cards)r.total=r.spend+r.perks+r.sub+r.other;
    const totals={spend:cards.reduce((n,c)=>n+c.spend,0),perks:cards.reduce((n,c)=>n+c.perks,0),sub:cards.reduce((n,c)=>n+c.sub,0),other:cards.reduce((n,c)=>n+c.other,0)};totals.cards=totals.spend+totals.perks+totals.sub+totals.other;totals.bank=base.bankNet;totals.combined=totals.cards+totals.bank;totals.nonCard=nonCard;totals.unclassified=unclassified;
    const bankRows=data.banks.map(b=>{let bonus=0,interest=0,fees=0;for(const e of data.bankEvents.filter(e=>e.bankId===b.id&&within(e,year,today))){if(e.type==='bonus')bonus+=e.amount;if(e.type==='interest')interest+=e.amount;if(e.type==='fee')fees+=e.amount;}const start=year==='all'?'1900-01-01':`${year}-01-01`,next=C.iso(new Date(C.date(today).getTime()+86400000)),end=year==='all'?next:`${Number(year)+1}-01-01`<next?`${Number(year)+1}-01-01`:next;const opportunity=C.occupied(data,b,start,end).dollarDays*(data.settings.opportunityRate||0)/100/365;const otherCosts=data.costs.filter(c=>c.bankId===b.id&&within(c,year,today)).reduce((n,c)=>n+c.amount,0);return {id:b.id,name:b.name,accountType:b.accountType||'unclassified',bonus,interest,fees,opportunity,net:bonus+interest-fees-opportunity-otherCosts};});
    const bankTypes=Object.create(null);for(const b of bankRows)bankTypes[b.accountType]=(bankTypes[b.accountType]||0)+b.net;
    return {cards,totals,byCategory,bankRows,bankTypes,missingValuations:[...missing],redemptionValue:base.redemptions,remainingValuation:base.valuation};
  }
  function bestCards(data,category,at=C.localDate()){
    return data.cards.filter(c=>C.opened(c,at)&&!C.cardState(data,c,at).closed).map(c=>{
      const rules=(data.rewardRules||[]).filter(r=>r.cardId===c.id&&(!r.validFrom||r.validFrom<=at)&&(!r.validTo||r.validTo>=at));
      const specific=rules.filter(r=>r.category===category),matches=specific.length?specific:rules.filter(r=>r.category==='other');if(!matches.length)return {cardId:c.id,name:c.name,rate:null,returnPercent:null,note:'未配置此类规则'};
      const choices=matches.map(r=>({...r,returnPercent:r.unit==='cash'?r.rate:r.rate*(data.settings.valuations[r.program]??0)})).sort((a,b)=>b.returnPercent-a.returnPercent);const r=choices[0];return {cardId:c.id,name:C.cardState(data,c,at).name,rate:r.rate,unit:r.unit,program:r.program,returnPercent:r.unit==='points'&&data.settings.valuations[r.program]==null?null:r.returnPercent,note:r.notes||'',unconfirmed:r.unconfirmedExpiry===true};
    }).sort((a,b)=>(b.returnPercent??-1)-(a.returnPercent??-1));
  }
  function subScenario(data,{cardId,bonusPoints,paymentAmount,feePercent=2.52,induced=0,foregone=0,normalRate=1}){
    const c=data.cards.find(c=>c.id===cardId),program=c?.subProgram||'Aeroplan',bonusValue=value(data,program,bonusPoints).amount,normalValue=value(data,program,paymentAmount*normalRate).amount,fee=paymentAmount*feePercent/100;
    return {bonusValue,normalValue,fee,induced,foregone,subNet:bonusValue-fee-induced-foregone,net:bonusValue+normalValue-fee-induced-foregone};
  }
  function migrate(data){data=structuredClone(data);data.rewardRules??=[];data.settings.valuations={UR:1.8,Aeroplan:1.8,...data.settings.valuations};return data;}
  const api={categories,within,value,report,bestCards,subScenario,migrate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PerkReports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
