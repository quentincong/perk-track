(function(root){
  'use strict';
  function encode(text){const bytes=new TextEncoder().encode(text);let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
  function decode(base64){return new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
  function config(c){if(!/^[A-Za-z0-9-]+$/.test(c.owner)||! /^[A-Za-z0-9._-]+$/.test(c.repo)||!c.token)throw new Error('填写有效的 GitHub 用户名、仓库名和 token。');if(!c.path||c.path.startsWith('/')||c.path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('数据路径应为相对文件路径，例如 data.json。');return c;}
  class GithubStore{
    constructor(c,request=root.fetch.bind(root)){this.c=config(c);this.request=request;this.sha=null;this.loaded=false;}
    url(){return `https://api.github.com/repos/${encodeURIComponent(this.c.owner)}/${encodeURIComponent(this.c.repo)}/contents/${this.c.path.split('/').map(encodeURIComponent).join('/')}`;}
    async call(url,options={}){const response=await this.request(url,{...options,signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.c.token}`,'X-GitHub-Api-Version':'2022-11-28',...options.headers}});if(!response.ok){const error=new Error(response.status===401?'GitHub 授权失败，请检查 token。':response.status===403?'GitHub 拒绝访问，请检查仓库权限或请求限额。':response.status===409?'云端文件有变化，已停止覆盖。请先备份本地数据，再读取云端。':`GitHub 请求失败（${response.status}）。请检查仓库、分支、文件路径及权限。`);error.status=response.status;throw error;}return response.json();}
    async read(){const q=this.c.branch?`?ref=${encodeURIComponent(this.c.branch)}`:'';const result=await this.call(this.url()+q);if(result.type!=='file'||result.encoding!=='base64')throw new Error('路径不是可读取的 JSON 文件，或文件过大。');this.sha=result.sha;this.loaded=true;return JSON.parse(decode(result.content));}
    async prepare(){await this.call(`https://api.github.com/repos/${encodeURIComponent(this.c.owner)}/${encodeURIComponent(this.c.repo)}`);try{const q=this.c.branch?`?ref=${encodeURIComponent(this.c.branch)}`:'';const file=await this.call(this.url()+q);this.sha=file.sha;this.loaded=true;return {exists:true};}catch(e){if(e.status===404){this.sha=null;this.loaded=true;return {exists:false};}throw e;}}
    async save(data){if(!this.loaded)throw new Error('请先测试连接并读取已有云端文件。');const content=encode(JSON.stringify(data,null,2));const body={message:`Update rewards ledger ${new Date().toISOString()}`,content};if(this.sha)body.sha=this.sha;if(this.c.branch)body.branch=this.c.branch;const result=await this.call(this.url(),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});this.sha=result.content.sha;return this.sha;}
  }
  const api={GithubStore,encode,decode,config};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PerkGithub=api;
})(typeof globalThis!=='undefined'?globalThis:this);
