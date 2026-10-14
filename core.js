(function (root) {
  'use strict';
  const collections = ['cards','creditEvents','perks','usages','banks','bankEvents','points','costs'];
  const dayMs = 86400000;
  const money = n => Math.round((Number(n) || 0) * 100) / 100;
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  function date(s) { return new Date(`${s}T00:00:00Z`); }
  function iso(d) { return d.toISOString().slice(0,10); }
  function days(a,b) { return Math.round((date(b)-date(a))/dayMs); }
  function anniversary(year, month, day) { return iso(new Date(Date.UTC(year,month,Math.min(day,new Date(Date.UTC(year,month+1,0)).getUTCDate())))); }
  function addMonths(s,n) { const d=date(s); const first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)); return anniversary(first.getUTCFullYear(),first.getUTCMonth(),d.getUTCDate()); }
  function blank() { return {schemaVersion:1,settings:{baseCurrency:'USD',opportunityRate:4,valuations:{UR:1.8,Aeroplan:1.8},demo:false},...Object.fromEntries(collections.map(k=>[k,[]]))}; }
  function validate(data) {
    if (!data || typeof data!=='object' || Array.isArray(data) || data.schemaVersion!==1) throw new Error('文件不是支持的 Perk Track v1 备份。');
    if (!data.settings || typeof data.settings!=='object' || Array.isArray(data.settings)) throw new Error('缺少有效设置。');
    const ids=new Set();
    for(const k of collections){if(!Array.isArray(data[k]))throw new Error(`缺少记录集合：${k}`);for(const r of data[k]){
      if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||ids.has(r.id))throw new Error('记录 ID 无效或重复。');ids.add(r.id);
      for(const [key,v] of Object.entries(r)){
        if(typeof v==='number'&&!Number.isFinite(v))throw new Error('金额或点数无效。');
        if((key.endsWith('Date')||key==='date')&&v && (typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(date(v).getTime())||iso(date(v))!==v))throw new Error(`日期无效：${key}`);
      }
    }}
    const refs={creditEvents:{cardId:'cards'},perks:{cardId:'cards'},usages:{perkId:'perks'},bankEvents:{bankId:'banks'},points:{cardId:'cards'},costs:{cardId:'cards',bankId:'banks'}};
    for(const [k,map]of Object.entries(refs))for(const r of data[k])for(const [f,target]of Object.entries(map))if(r[f]&&!data[target].some(t=>t.id===r[f]))throw new Error(`记录 ${r.id} 引用了不存在的关联。`);
    for(const k of collections)for(const r of data[k])for(const key of ['amount','received','cashReference','taxes','purchaseCost','faceUsed','actualValue','limit','initialLimit','annualFee','subGoal','subSpent','subPoints','allowance','expectedBonus','ddTarget','ddCountTarget','balanceTarget','holdDays'])if(r[key]!=null && (typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<0))throw new Error(`数值无效：${key}`);
    const allowed={bankEvents:{type:['deposit','dd','withdrawal','bonus','interest','fee']},points:{type:['earn','buy','transfer','redeem','refund','expire','cashback','adjust-in','adjust-out','balance']},creditEvents:{type:['limit','product','close','reopen']},perks:{cycle:['monthly','quarterly','semiannual','annual','anniversary','custom']},cards:{kind:['personal','business','authorized']}};
    for(const [k,map]of Object.entries(allowed))for(const r of data[k])for(const [f,list]of Object.entries(map))if(!list.includes(r[f]))throw new Error(`记录类型无效：${k}.${f}`);
    const required={cards:['name','issuer'],creditEvents:['cardId','date'],perks:['name','cardId'],usages:['perkId','date'],banks:['name','openDate'],bankEvents:['bankId','date'],points:['date','program'],costs:['date','name']};
    for(const [k,fields]of Object.entries(required))for(const r of data[k])for(const f of fields)if(!r[f]){if(f==='date'&&['bankEvents','costs','points'].includes(k)&&(!r.type||['bonus','interest','fee','earn','cashback'].includes(r.type))&&Number.isInteger(r.periodYear)&&r.periodYear>=1900&&r.periodYear<=2100)continue;if(f==='date'&&k==='usages'&&/^\d{4}-\d{2}-\d{2}$/.test(r.periodStart||'')&&/^\d{4}-\d{2}-\d{2}$/.test(r.periodEnd||''))continue;throw new Error(`缺少必填字段：${k}.${f}`);}
    for(const c of data.cards)if(!c.openDate&&!c.openUnknown&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(c.openMonth||''))throw new Error('信用卡需填写开户日期、月份，或标记开户日期未知。');
    for(const c of data.cards)if(c.subMilestones&&(!Array.isArray(c.subMilestones)||c.subMilestones.some(m=>!Number.isFinite(m.points)||m.points<0||m.spendGoal!=null&&(!Number.isFinite(m.spendGoal)||m.spendGoal<0)||!/^\d{4}-\d{2}-\d{2}$/.test(m.deadline)||Number.isNaN(date(m.deadline).getTime())||iso(date(m.deadline))!==m.deadline||!['pending','received'].includes(m.status))))throw new Error('SUB 档位无效。');
    for(const k of ['cards','banks'])for(const r of data[k])if(r.closeMonth&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.closeMonth))throw new Error('关户月份无效。');
    for(const k of ['points','bankEvents','costs'])for(const r of data[k])if(typeof r.amount!=='number')throw new Error(`缺少金额或点数：${k}`);
    for(const r of data.creditEvents)if(r.type==='limit'&&typeof r.limit!=='number')throw new Error('额度事件缺少有效 CL。');
    for(const p of data.points)for(const name of [p.program,p.targetProgram])if(name&&['__proto__','constructor','prototype'].includes(name))throw new Error('积分计划名称无效。');
    if(Object.keys(data.settings.valuations||{}).some(p=>['__proto__','constructor','prototype'].includes(p)))throw new Error('估值计划名称无效。');
    for(const p of data.points)if(p.type==='transfer'&&(!p.targetProgram||p.targetProgram===p.program||!p.amount||!p.received))throw new Error('转点记录需有效的不同计划与实际点数。');
    for(const p of data.perks)if(p.cycle==='custom'&&(!p.startDate||!p.endDate||p.endDate<p.startDate))throw new Error('指定权益周期无效。');
    for(const c of data.costs)if(c.cardId&&c.bankId)throw new Error('费用只能有一种归属。');
    if(data.rewardRules!=null){if(!Array.isArray(data.rewardRules))throw new Error('消费返利规则无效。');for(const r of data.rewardRules){if(!r.id||ids.has(r.id)||!data.cards.some(c=>c.id===r.cardId)||!r.category||!['cash','points'].includes(r.unit)||!Number.isFinite(r.rate)||r.rate<0||r.unit==='points'&&!r.program)throw new Error('消费返利规则字段无效。');ids.add(r.id);for(const k of ['validFrom','validTo'])if(r[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(r[k])||Number.isNaN(date(r[k]).getTime())||iso(date(r[k]))!==r[k]))throw new Error('消费规则日期无效。');}}
    for(const c of data.costs)for(const k of ['paymentBase','feePercent'])if(c[k]!=null&&(!Number.isFinite(c[k])||c[k]<0))throw new Error('手续费本金与比例必须非负。');
    for(const k of ['cards','banks'])for(const r of data[k])if(r.closeDate&&r.closeDate<r.openDate)throw new Error('关闭日期早于开户日期。');
    for(const b of data.banks){let balance=0;for(const e of data.bankEvents.filter(e=>e.bankId===b.id).sort((a,b)=>a.date.localeCompare(b.date))){if(e.date&&(e.date<b.openDate||b.closeDate&&e.date>b.closeDate))throw new Error('银行流水日期不在开户与关户区间。');if(['dd','deposit'].includes(e.type))balance+=e.amount||0;if(e.type==='withdrawal'){balance-=e.amount||0;if(balance<-.005)throw new Error('本金取出超过已录入本金，请补录存入流水。');}}}
    if(!Number.isFinite(data.settings.opportunityRate)||data.settings.opportunityRate<0||!data.settings.valuations||typeof data.settings.valuations!=='object'||Array.isArray(data.settings.valuations)||Object.values(data.settings.valuations).some(v=>!Number.isFinite(v)||v<0))throw new Error('估值或机会成本利率无效。');
    return structuredClone(data);
  }
  function period(perk, cards, today=localDate()) {
    if(perk.cycleConfirmed===false)return {start:'',end:perk.endDate?iso(new Date(date(perk.endDate).getTime()+dayMs)):'',lastDay:perk.endDate||''};
    const d=date(today), y=d.getUTCFullYear(), m=d.getUTCMonth(); let start,end;
    if(perk.cycle==='monthly'){start=anniversary(y,m,1);end=addMonths(start,1);}
    else if(perk.cycle==='quarterly'){start=anniversary(y,Math.floor(m/3)*3,1);end=addMonths(start,3);}
    else if(perk.cycle==='semiannual'){start=anniversary(y,m<6?0:6,1);end=addMonths(start,6);}
    else if(perk.cycle==='anniversary'){
      const anchor=perk.anchorDate||cards.find(c=>c.id===perk.cardId)?.openDate||`${y}-01-01`;const a=date(anchor);
      start=anniversary(y,a.getUTCMonth(),a.getUTCDate());if(start>today)start=anniversary(y-1,a.getUTCMonth(),a.getUTCDate());
      end=anniversary(date(start).getUTCFullYear()+1,a.getUTCMonth(),a.getUTCDate());
    }else if(perk.cycle==='custom'){start=perk.startDate||today;end=iso(new Date(date(perk.endDate||today).getTime()+dayMs));}
    else{start=`${y}-01-01`;end=`${y+1}-01-01`;}
    return {start,end,lastDay:iso(new Date(date(end).getTime()-dayMs))};
  }
  function perkProgress(data,perk,today=localDate()) {const p=period(perk,data.cards,today);const used=data.usages.filter(u=>u.perkId===perk.id&&(u.date?u.date>=p.start&&u.date<p.end&&u.date<=today:u.periodStart===p.start&&u.periodEnd===p.end)).reduce((n,u)=>n+(u.faceUsed||0),0);return {...p,used,remaining:perk.allowance==null?null:Math.max(0,perk.allowance-used)};}
  function opened(c,today=localDate()){return !!(c.openUnknown|| (c.openDate?c.openDate<=today:c.openMonth&&c.openMonth<=today.slice(0,7)));}
  function isClosed(c,today=localDate()){return !!(c.closeDate?c.closeDate<=today:c.closeMonth&&c.closeMonth<today.slice(0,7));}
  function cardState(data,c,today=localDate()) {let limit=c.initialLimit??null,name=c.name,closed=isClosed(c,today);for(const e of data.creditEvents.filter(e=>e.cardId===c.id&&e.date<=today).sort((a,b)=>a.date.localeCompare(b.date))){if(e.type==='limit')limit=e.limit;if(e.type==='product')name=e.productName||name;if(e.type==='close')closed=true;if(e.type==='reopen')closed=false;}return {limit,name,closed};}
  function velocity(data,today=localDate()) {
    const bounds=c=>c.openDate?[c.openDate,c.openDate]:c.openMonth?[`${c.openMonth}-01`,iso(new Date(Date.UTC(Number(c.openMonth.slice(0,4)),Number(c.openMonth.slice(5)),0)))]:['1900-01-01','9999-01-01'];
    const qualifies=(c,n)=>{if(c.kind!=='personal')return false;const [lo,hi]=bounds(c);return hi<=today&&lo>addMonths(today,-n);};
    const counts=n=>data.cards.filter(c=>qualifies(c,n)).length;
    const eligible=data.cards.filter(c=>qualifies(c,24));
    const uncertain=data.cards.filter(c=>c.kind==='personal'&&!c.openDate&&(!c.openMonth||[6,12,24].some(n=>{const [lo,hi]=bounds(c);const cutoff=addMonths(today,-n);return lo<=cutoff&&hi>cutoff||lo<=today&&hi>today;}))).length;
    return {six:counts(6),twelve:counts(12),twentyFour:eligible.length,uncertain,nextDrop:eligible.length?eligible.map(c=>c.openDate?addMonths(c.openDate,24):addMonths(`${c.openMonth}-01`,24).slice(0,7)+'（具体日待核对）').sort()[0]:null};
  }
  function balances(data,today=localDate()) {
    const result=Object.create(null);const add=(p,n)=>{result[p]=(result[p]||0)+n;};
    const events=data.points.filter(r=>r.date?r.date<=today:r.periodYear<=Number(today.slice(0,4)));
    for(const r of events.slice().sort((a,b)=>a.date.localeCompare(b.date))){
      if(r.type==='balance')result[r.program]=r.amount;
      if(['earn','buy','refund','adjust-in'].includes(r.type))add(r.program,r.amount||0);
      if(['redeem','expire','adjust-out'].includes(r.type)||r.type==='transfer'&&r.trackSourceBalance!==false)add(r.program,-(r.amount||0));
      if(r.type==='transfer')add(r.targetProgram,r.received||0);
    }for(const p of data.settings.incompletePointPrograms||[])if(!events.some(e=>e.program===p&&e.type==='balance'))delete result[p];return result;
  }
  function occupied(data,bank,start,end) {
    if(bank.capitalComplete===false)return {balance:null,dollarDays:0};
    let balance=0,area=0,previous=bank.openDate;const stop=bank.closeDate&&bank.closeDate<end?bank.closeDate:end;
    if(stop<=bank.openDate)return {balance:0,dollarDays:0};
    for(const e of data.bankEvents.filter(e=>e.bankId===bank.id&&['deposit','dd','withdrawal'].includes(e.type)&&e.date>=bank.openDate&&e.date<stop).sort((a,b)=>a.date.localeCompare(b.date))){
      const lo=previous>start?previous:start;const hi=e.date<stop?e.date:stop;if(hi>lo)area+=balance*days(lo,hi);
      balance=Math.max(0,balance+(e.type==='withdrawal'?-e.amount:e.amount));previous=e.date;
    }
    const lo=previous>start?previous:start;if(stop>lo)area+=balance*days(lo,stop);
    return {balance:bank.closeDate&&bank.closeDate<=end?0:balance,dollarDays:area};
  }
  function summary(data,year='all',today=localDate()) {
    const start=year==='all'?'1900-01-01':`${year}-01-01`;const futureEnd=year==='all'?'9999-01-01':`${Number(year)+1}-01-01`;
    const tomorrow=iso(new Date(date(today).getTime()+dayMs));const end=futureEnd<tomorrow?futureEnd:tomorrow;
    const within=r=>r.date?r.date>=start&&r.date<end:Number.isInteger(r.periodYear)&&(year==='all'||Number(year)===r.periodYear)&&r.periodYear<=Number(today.slice(0,4));let bankBonus=0,interest=0,bankFees=0,redemptions=0,cashback=0,purchases=0;
    for(const e of data.bankEvents.filter(within)){if(e.type==='bonus')bankBonus+=e.amount;if(e.type==='interest')interest+=e.amount;if(e.type==='fee')bankFees+=e.amount;}
    for(const p of data.points.filter(within)){if(p.type==='redeem')redemptions+=(p.cashReference||0)-(p.taxes||0);if(p.type==='refund')redemptions-=(p.cashReference||0)-(p.taxes||0);if(p.type==='cashback')cashback+=p.amount||0;if(p.type==='buy')purchases+=p.purchaseCost||0;}
    const perks=data.usages.filter(within).reduce((n,u)=>n+(u.actualValue||0),0);
    const costs=data.costs.filter(within).reduce((n,c)=>n+(c.amount||0),0);
    const capital=data.banks.reduce((n,b)=>n+occupied(data,b,start,end).dollarDays,0);
    const opportunity=capital*(data.settings.opportunityRate||0)/100/365;
    const bankNet=bankBonus+interest-bankFees-opportunity-data.costs.filter(c=>within(c)&&c.bankId).reduce((n,c)=>n+c.amount,0);
    const net=bankBonus+interest+redemptions+cashback+perks-bankFees-costs-purchases-opportunity;
    const pointBalances=balances(data,today);const valuation=Object.entries(pointBalances).reduce((n,[p,q])=>n+q*(data.settings.valuations[p]||0)/100,0);
    return {bankBonus,interest,bankFees,redemptions,cashback,perks,costs,purchases,opportunity,capital,bankNet,bankAnnualized:capital>0?bankNet/capital*365*100:null,net,valuation,balances:pointBalances};
  }
  function bankProgress(data,bank,today=localDate()) {const events=data.bankEvents.filter(e=>e.bankId===bank.id&&e.date<=today);const dd=events.filter(e=>e.type==='dd');return {ddAmount:Math.max(dd.reduce((n,e)=>n+e.amount,0),bank.confirmedDDTotal||0),ddCount:Math.max(dd.length,bank.confirmedDDCount||0),bonus:events.filter(e=>e.type==='bonus').reduce((n,e)=>n+e.amount,0),balance:occupied(data,bank,'1900-01-01',iso(new Date(date(today).getTime()+dayMs))).balance};}
  function cpp(r) {return r.type==='redeem'&&r.amount>0?((r.cashReference||0)-(r.taxes||0))/r.amount*100:null;}
  function demo(today=localDate()) {
    const data=blank();data.settings.demo=true;const y=today.slice(0,4);const shift=n=>iso(new Date(date(today).getTime()+n*dayMs));
    data.cards=[{id:'demo-card-a',name:'Travel Card · 示例',issuer:'Example Bank',kind:'personal',openDate:addMonths(today,-3),initialLimit:5000,annualFee:95,feeDate:shift(28),subGoal:4000,subSpent:3250,subPoints:75000,subProgram:'UR',subDeadline:shift(14),notes:'虚构演示数据，不代表任何真实信用卡条款。'},{id:'demo-card-b',name:'Everyday Card · 示例',issuer:'Example Bank',kind:'personal',openDate:addMonths(today,-8),initialLimit:3700,annualFee:0,notes:'示例卡片。'}];
    data.creditEvents=[{id:'demo-credit',cardId:'demo-card-b',type:'limit',date:shift(-20),limit:4500,notes:'信用额度调整示例'}];
    data.perks=[{id:'demo-perk-a',cardId:'demo-card-a',name:'旅行报销 · 示例',cycle:'annual',allowance:100,notes:'请按真实条款修改。'},{id:'demo-perk-b',cardId:'demo-card-a',name:'餐饮报销 · 示例',cycle:'monthly',allowance:10,notes:'虚构月度权益'}];
    data.usages=[{id:'demo-usage',perkId:'demo-perk-a',date:shift(-15),faceUsed:60,actualValue:50,posted:true,notes:'使用了 $60，个人认可价值 $50'}];
    data.banks=[{id:'demo-bank',name:'Savings Bonus · 示例',openDate:shift(-45),expectedBonus:400,ddTarget:0,ddCountTarget:0,balanceTarget:20000,holdDays:60,deadline:shift(15),safeCloseDate:shift(30),eligibleDate:'',notes:'虚构存款奖励，不代表银行实际 offer。'}];
    data.bankEvents=[{id:'demo-deposit',bankId:'demo-bank',date:shift(-45),type:'deposit',amount:20000,notes:'资金转入，不算收益'},{id:'demo-bankbonus',bankId:'demo-bank',date:shift(-5),type:'bonus',amount:400,notes:'奖励实收示例'},{id:'demo-interest',bankId:'demo-bank',date:shift(-5),type:'interest',amount:65,notes:'利息实收'}];
    data.points=[{id:'demo-earn',date:shift(-60),type:'earn',program:'UR',amount:80000,cardId:'demo-card-a',notes:'包含历史期初余额的赚点示例'},{id:'demo-transfer',date:shift(-25),type:'transfer',program:'UR',amount:50000,targetProgram:'Aeroplan',received:60000,notes:'20% 转点奖励已入账'},{id:'demo-redeem',date:shift(-10),type:'redeem',program:'Aeroplan',amount:25000,cashReference:450,taxes:50,notes:'现金参考价 $450，税费 $50'}];
    data.costs=[{id:'demo-fee',date:addMonths(today,-3),name:'年费 · 示例',amount:95,cardId:'demo-card-a',bankId:'',notes:'只记录已发生费用'}];return data;
  }
  const api={collections,money,localDate,date,iso,days,addMonths,blank,validate,period,perkProgress,cardState,velocity,balances,occupied,summary,bankProgress,cpp,demo,opened,isClosed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PerkCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
