var Er=Object.defineProperty;var Cr=(n,e)=>{for(var t in e)Er(n,t,{get:e[t],enumerable:!0})};var z;(c=>(c.dereferencePointer=l=>({kind:"dereference-pointer",pointer:l}),c.saveRegions=l=>({kind:"save-regions",regions:l}),c.saveVariables=l=>({kind:"save-variables",variables:l}),c.restoreVariables=l=>({kind:"restore-variables",variables:l}),c.pushRegionRenames=l=>({kind:"push-region-renames",mapping:l}),c.popRegionRenames=()=>({kind:"pop-region-renames"}),c.pushTemplates=l=>({kind:"push-templates",templates:l}),c.popTemplates=()=>({kind:"pop-templates"})))(z||={});var vt=Symbol.for("yaml.alias"),St=Symbol.for("yaml.document"),ee=Symbol.for("yaml.map"),xn=Symbol.for("yaml.pair"),Q=Symbol.for("yaml.scalar"),be=Symbol.for("yaml.seq"),V=Symbol.for("yaml.node.type"),X=n=>!!n&&typeof n=="object"&&n[V]===vt,te=n=>!!n&&typeof n=="object"&&n[V]===St,ne=n=>!!n&&typeof n=="object"&&n[V]===ee,E=n=>!!n&&typeof n=="object"&&n[V]===xn,j=n=>!!n&&typeof n=="object"&&n[V]===Q,ie=n=>!!n&&typeof n=="object"&&n[V]===be;function q(n){if(n&&typeof n=="object")switch(n[V]){case ee:case be:return!0}return!1}function C(n){if(n&&typeof n=="object")switch(n[V]){case vt:case ee:case Q:case be:return!0}return!1}var At=n=>(j(n)||q(n))&&!!n.anchor;var H=Symbol("break visit"),oi=Symbol("skip children"),pe=Symbol("remove node");function fe(n,e){let t=ai(e);te(n)?Me(null,n.contents,t,Object.freeze([n]))===pe&&(n.contents=null):Me(null,n,t,Object.freeze([]))}fe.BREAK=H;fe.SKIP=oi;fe.REMOVE=pe;function Me(n,e,t,i){let r=ci(n,e,t,i);if(C(r)||E(r))return li(n,i,r),Me(n,r,t,i);if(typeof r!="symbol"){if(q(e)){i=Object.freeze(i.concat(e));for(let s=0;s<e.items.length;++s){let o=Me(s,e.items[s],t,i);if(typeof o=="number")s=o-1;else{if(o===H)return H;o===pe&&(e.items.splice(s,1),s-=1)}}}else if(E(e)){i=Object.freeze(i.concat(e));let s=Me("key",e.key,t,i);if(s===H)return H;s===pe&&(e.key=null);let o=Me("value",e.value,t,i);if(o===H)return H;o===pe&&(e.value=null)}}return r}async function Tt(n,e){let t=ai(e);te(n)?await Ue(null,n.contents,t,Object.freeze([n]))===pe&&(n.contents=null):await Ue(null,n,t,Object.freeze([]))}Tt.BREAK=H;Tt.SKIP=oi;Tt.REMOVE=pe;async function Ue(n,e,t,i){let r=await ci(n,e,t,i);if(C(r)||E(r))return li(n,i,r),Ue(n,r,t,i);if(typeof r!="symbol"){if(q(e)){i=Object.freeze(i.concat(e));for(let s=0;s<e.items.length;++s){let o=await Ue(s,e.items[s],t,i);if(typeof o=="number")s=o-1;else{if(o===H)return H;o===pe&&(e.items.splice(s,1),s-=1)}}}else if(E(e)){i=Object.freeze(i.concat(e));let s=await Ue("key",e.key,t,i);if(s===H)return H;s===pe&&(e.key=null);let o=await Ue("value",e.value,t,i);if(o===H)return H;o===pe&&(e.value=null)}}return r}function ai(n){return typeof n=="object"&&(n.Collection||n.Node||n.Value)?Object.assign({Alias:n.Node,Map:n.Node,Scalar:n.Node,Seq:n.Node},n.Value&&{Map:n.Value,Scalar:n.Value,Seq:n.Value},n.Collection&&{Map:n.Collection,Seq:n.Collection},n):n}function ci(n,e,t,i){if(typeof t=="function")return t(n,e,i);if(ne(e))return t.Map?.(n,e,i);if(ie(e))return t.Seq?.(n,e,i);if(E(e))return t.Pair?.(n,e,i);if(j(e))return t.Scalar?.(n,e,i);if(X(e))return t.Alias?.(n,e,i)}function li(n,e,t){let i=e[e.length-1];if(q(i))i.items[n]=t;else if(E(i))n==="key"?i.key=t:i.value=t;else if(te(i))i.contents=t;else{let r=X(i)?"alias":"scalar";throw new Error(`Cannot replace node with ${r} parent`)}}var Ir={"!":"%21",",":"%2C","[":"%5B","]":"%5D","{":"%7B","}":"%7D"},Pr=n=>n.replace(/[!,[\]{}]/g,e=>Ir[e]),de=class n{constructor(e,t){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},n.defaultYaml,e),this.tags=Object.assign({},n.defaultTags,t)}clone(){let e=new n(this.yaml,this.tags);return e.docStart=this.docStart,e}atDocument(){let e=new n(this.yaml,this.tags);switch(this.yaml.version){case"1.1":this.atNextDocument=!0;break;case"1.2":this.atNextDocument=!1,this.yaml={explicit:n.defaultYaml.explicit,version:"1.2"},this.tags=Object.assign({},n.defaultTags);break}return e}add(e,t){this.atNextDocument&&(this.yaml={explicit:n.defaultYaml.explicit,version:"1.1"},this.tags=Object.assign({},n.defaultTags),this.atNextDocument=!1);let i=e.trim().split(/[ \t]+/),r=i.shift();switch(r){case"%TAG":{if(i.length!==2&&(t(0,"%TAG directive should contain exactly two parts"),i.length<2))return!1;let[s,o]=i;return this.tags[s]=o,!0}case"%YAML":{if(this.yaml.explicit=!0,i.length!==1)return t(0,"%YAML directive should contain exactly one part"),!1;let[s]=i;if(s==="1.1"||s==="1.2")return this.yaml.version=s,!0;{let o=/^\d+\.\d+$/.test(s);return t(6,`Unsupported YAML version ${s}`,o),!1}}default:return t(0,`Unknown directive ${r}`,!0),!1}}tagName(e,t){if(e==="!")return"!";if(e[0]!=="!")return t(`Not a valid tag: ${e}`),null;if(e[1]==="<"){let o=e.slice(2,-1);return o==="!"||o==="!!"?(t(`Verbatim tags aren't resolved, so ${e} is invalid.`),null):(e[e.length-1]!==">"&&t("Verbatim tags must end with a >"),o)}let[,i,r]=e.match(/^(.*!)([^!]*)$/s);r||t(`The ${e} tag has no suffix`);let s=this.tags[i];if(s)try{return s+decodeURIComponent(r)}catch(o){return t(String(o)),null}return i==="!"?e:(t(`Could not resolve tag: ${e}`),null)}tagString(e){for(let[t,i]of Object.entries(this.tags))if(e.startsWith(i))return t+Pr(e.substring(i.length));return e[0]==="!"?e:`!<${e}>`}toString(e){let t=this.yaml.explicit?[`%YAML ${this.yaml.version||"1.2"}`]:[],i=Object.entries(this.tags),r;if(e&&i.length>0&&C(e.contents)){let s={};fe(e.contents,(o,a)=>{C(a)&&a.tag&&(s[a.tag]=!0)}),r=Object.keys(s)}else r=[];for(let[s,o]of i)s==="!!"&&o==="tag:yaml.org,2002:"||(!e||r.some(a=>a.startsWith(o)))&&t.push(`%TAG ${s} ${o}`);return t.join(`
`)}};de.defaultYaml={explicit:!1,version:"1.2"};de.defaultTags={"!!":"tag:yaml.org,2002:"};function jt(n){if(/[\x00-\x19\s,[\]{}]/.test(n)){let t=`Anchor must not contain whitespace or control characters: ${JSON.stringify(n)}`;throw new Error(t)}return!0}function wn(n){let e=new Set;return fe(n,{Value(t,i){i.anchor&&e.add(i.anchor)}}),e}function kn(n,e){for(let t=1;;++t){let i=`${n}${t}`;if(!e.has(i))return i}}function pi(n,e){let t=[],i=new Map,r=null;return{onAnchor:s=>{t.push(s),r??(r=wn(n));let o=kn(e,r);return r.add(o),o},setAnchors:()=>{for(let s of t){let o=i.get(s);if(typeof o=="object"&&o.anchor&&(j(o.node)||q(o.node)))o.node.anchor=o.anchor;else{let a=new Error("Failed to resolve repeated object (this should not happen)");throw a.source=s,a}}},sourceObjects:i}}function Te(n,e,t,i){if(i&&typeof i=="object")if(Array.isArray(i))for(let r=0,s=i.length;r<s;++r){let o=i[r],a=Te(n,i,String(r),o);a===void 0?delete i[r]:a!==o&&(i[r]=a)}else if(i instanceof Map)for(let r of Array.from(i.keys())){let s=i.get(r),o=Te(n,i,r,s);o===void 0?i.delete(r):o!==s&&i.set(r,o)}else if(i instanceof Set)for(let r of Array.from(i)){let s=Te(n,i,r,r);s===void 0?i.delete(r):s!==r&&(i.delete(r),i.add(s))}else for(let[r,s]of Object.entries(i)){let o=Te(n,i,r,s);o===void 0?delete i[r]:o!==s&&(i[r]=o)}return n.call(e,t,i)}function B(n,e,t){if(Array.isArray(n))return n.map((i,r)=>B(i,String(r),t));if(n&&typeof n.toJSON=="function"){if(!t||!At(n))return n.toJSON(e,t);let i={aliasCount:0,count:1,res:void 0};t.anchors.set(n,i),t.onCreate=s=>{i.res=s,delete t.onCreate};let r=n.toJSON(e,t);return t.onCreate&&t.onCreate(r),r}return typeof n=="bigint"&&!t?.keep?Number(n):n}var je=class{constructor(e){Object.defineProperty(this,V,{value:e})}clone(){let e=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(e.range=this.range.slice()),e}toJS(e,{mapAsMap:t,maxAliasCount:i,onAnchor:r,reviver:s}={}){if(!te(e))throw new TypeError("A document argument is required");let o={anchors:new Map,doc:e,keep:!0,mapAsMap:t===!0,mapKeyWarned:!1,maxAliasCount:typeof i=="number"?i:100},a=B(this,"",o);if(typeof r=="function")for(let{count:c,res:l}of o.anchors.values())r(l,c);return typeof s=="function"?Te(s,{"":a},"",a):a}};var xe=class extends je{constructor(e){super(vt),this.source=e,Object.defineProperty(this,"tag",{set(){throw new Error("Alias nodes cannot have tags")}})}resolve(e,t){let i;t?.aliasResolveCache?i=t.aliasResolveCache:(i=[],fe(e,{Node:(s,o)=>{(X(o)||At(o))&&i.push(o)}}),t&&(t.aliasResolveCache=i));let r;for(let s of i){if(s===this)break;s.anchor===this.source&&(r=s)}return r}toJSON(e,t){if(!t)return{source:this.source};let{anchors:i,doc:r,maxAliasCount:s}=t,o=this.resolve(r,t);if(!o){let c=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new ReferenceError(c)}let a=i.get(o);if(a||(B(o,null,t),a=i.get(o)),a?.res===void 0){let c="This should not happen: Alias anchor was not resolved?";throw new ReferenceError(c)}if(s>=0&&(a.count+=1,a.aliasCount===0&&(a.aliasCount=Ot(r,o,i)),a.count*a.aliasCount>s)){let c="Excessive alias count indicates a resource exhaustion attack";throw new ReferenceError(c)}return a.res}toString(e,t,i){let r=`*${this.source}`;if(e){if(jt(this.source),e.options.verifyAliasOrder&&!e.anchors.has(this.source)){let s=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new Error(s)}if(e.implicitKey)return`${r} `}return r}};function Ot(n,e,t){if(X(e)){let i=e.resolve(n),r=t&&i&&t.get(i);return r?r.count*r.aliasCount:0}else if(q(e)){let i=0;for(let r of e.items){let s=Ot(n,r,t);s>i&&(i=s)}return i}else if(E(e)){let i=Ot(n,e.key,t),r=Ot(n,e.value,t);return Math.max(i,r)}return 1}var Et=n=>!n||typeof n!="function"&&typeof n!="object",v=class extends je{constructor(e){super(Q),this.value=e}toJSON(e,t){return t?.keep?this.value:B(this.value,e,t)}toString(){return String(this.value)}};v.BLOCK_FOLDED="BLOCK_FOLDED";v.BLOCK_LITERAL="BLOCK_LITERAL";v.PLAIN="PLAIN";v.QUOTE_DOUBLE="QUOTE_DOUBLE";v.QUOTE_SINGLE="QUOTE_SINGLE";var qr="tag:yaml.org,2002:";function Lr(n,e,t){if(e){let i=t.filter(s=>s.tag===e),r=i.find(s=>!s.format)??i[0];if(!r)throw new Error(`Tag ${e} not found`);return r}return t.find(i=>i.identify?.(n)&&!i.format)}function we(n,e,t){if(te(n)&&(n=n.contents),C(n))return n;if(E(n)){let p=t.schema[ee].createNode?.(t.schema,null,t);return p.items.push(n),p}(n instanceof String||n instanceof Number||n instanceof Boolean||typeof BigInt<"u"&&n instanceof BigInt)&&(n=n.valueOf());let{aliasDuplicateObjects:i,onAnchor:r,onTagObj:s,schema:o,sourceObjects:a}=t,c;if(i&&n&&typeof n=="object"){if(c=a.get(n),c)return c.anchor??(c.anchor=r(n)),new xe(c.anchor);c={anchor:null,node:null},a.set(n,c)}e?.startsWith("!!")&&(e=qr+e.slice(2));let l=Lr(n,e,o.tags);if(!l){if(n&&typeof n.toJSON=="function"&&(n=n.toJSON()),!n||typeof n!="object"){let p=new v(n);return c&&(c.node=p),p}l=n instanceof Map?o[ee]:Symbol.iterator in Object(n)?o[be]:o[ee]}s&&(s(l),delete t.onTagObj);let f=l?.createNode?l.createNode(t.schema,n,t):typeof l?.nodeClass?.from=="function"?l.nodeClass.from(t.schema,n,t):new v(n);return e?f.tag=e:l.default||(f.tag=l.tag),c&&(c.node=f),f}function tt(n,e,t){let i=t;for(let r=e.length-1;r>=0;--r){let s=e[r];if(typeof s=="number"&&Number.isInteger(s)&&s>=0){let o=[];o[s]=i,i=o}else i=new Map([[s,i]])}return we(i,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw new Error("This should not happen, please report a bug.")},schema:n,sourceObjects:new Map})}var Ve=n=>n==null||typeof n=="object"&&!!n[Symbol.iterator]().next().done,Ke=class extends je{constructor(e,t){super(e),Object.defineProperty(this,"schema",{value:t,configurable:!0,enumerable:!1,writable:!0})}clone(e){let t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return e&&(t.schema=e),t.items=t.items.map(i=>C(i)||E(i)?i.clone(e):i),this.range&&(t.range=this.range.slice()),t}addIn(e,t){if(Ve(e))this.add(t);else{let[i,...r]=e,s=this.get(i,!0);if(q(s))s.addIn(r,t);else if(s===void 0&&this.schema)this.set(i,tt(this.schema,r,t));else throw new Error(`Expected YAML collection at ${i}. Remaining path: ${r}`)}}deleteIn(e){let[t,...i]=e;if(i.length===0)return this.delete(t);let r=this.get(t,!0);if(q(r))return r.deleteIn(i);throw new Error(`Expected YAML collection at ${t}. Remaining path: ${i}`)}getIn(e,t){let[i,...r]=e,s=this.get(i,!0);return r.length===0?!t&&j(s)?s.value:s:q(s)?s.getIn(r,t):void 0}hasAllNullValues(e){return this.items.every(t=>{if(!E(t))return!1;let i=t.value;return i==null||e&&j(i)&&i.value==null&&!i.commentBefore&&!i.comment&&!i.tag})}hasIn(e){let[t,...i]=e;if(i.length===0)return this.has(t);let r=this.get(t,!0);return q(r)?r.hasIn(i):!1}setIn(e,t){let[i,...r]=e;if(r.length===0)this.set(i,t);else{let s=this.get(i,!0);if(q(s))s.setIn(r,t);else if(s===void 0&&this.schema)this.set(i,tt(this.schema,r,t));else throw new Error(`Expected YAML collection at ${i}. Remaining path: ${r}`)}}};var fi=n=>n.replace(/^(?!$)(?: $)?/gm,"#");function Z(n,e){return/^\n+$/.test(n)?n.substring(1):e?n.replace(/^(?! *$)/gm,e):n}var me=(n,e,t)=>n.endsWith(`
`)?Z(t,e):t.includes(`
`)?`
`+Z(t,e):(n.endsWith(" ")?"":" ")+t;var $n="flow",Ct="block",nt="quoted";function it(n,e,t="flow",{indentAtStart:i,lineWidth:r=80,minContentWidth:s=20,onFold:o,onOverflow:a}={}){if(!r||r<0)return n;r<s&&(s=0);let c=Math.max(1+s,1+r-e.length);if(n.length<=c)return n;let l=[],f={},p=r-e.length;typeof i=="number"&&(i>r-Math.max(2,s)?l.push(0):p=r-i);let m,u,g=!1,h=-1,x=-1,y=-1;t===Ct&&(h=di(n,h,e.length),h!==-1&&(p=h+c));for(let $;$=n[h+=1];){if(t===nt&&$==="\\"){switch(x=h,n[h+1]){case"x":h+=3;break;case"u":h+=5;break;case"U":h+=9;break;default:h+=1}y=h}if($===`
`)t===Ct&&(h=di(n,h,e.length)),p=h+e.length+c,m=void 0;else{if($===" "&&u&&u!==" "&&u!==`
`&&u!=="	"){let d=n[h+1];d&&d!==" "&&d!==`
`&&d!=="	"&&(m=h)}if(h>=p)if(m)l.push(m),p=m+c,m=void 0;else if(t===nt){for(;u===" "||u==="	";)u=$,$=n[h+=1],g=!0;let d=h>y+1?h-2:x-1;if(f[d])return n;l.push(d),f[d]=!0,p=d+c,m=void 0}else g=!0}u=$}if(g&&a&&a(),l.length===0)return n;o&&o();let b=n.slice(0,l[0]);for(let $=0;$<l.length;++$){let d=l[$],S=l[$+1]||n.length;d===0?b=`
${e}${n.slice(0,S)}`:(t===nt&&f[d]&&(b+=`${n[d]}\\`),b+=`
${e}${n.slice(d+1,S)}`)}return b}function di(n,e,t){let i=e,r=e+1,s=n[r];for(;s===" "||s==="	";)if(e<r+t)s=n[++e];else{do s=n[++e];while(s&&s!==`
`);i=e,r=e+1,s=n[r]}return i}var Pt=(n,e)=>({indentAtStart:e?n.indent.length:n.indentAtStart,lineWidth:n.options.lineWidth,minContentWidth:n.options.minContentWidth}),qt=n=>/^(%|---|\.\.\.)/m.test(n);function Nr(n,e,t){if(!e||e<0)return!1;let i=e-t,r=n.length;if(r<=i)return!1;for(let s=0,o=0;s<r;++s)if(n[s]===`
`){if(s-o>i)return!0;if(o=s+1,r-o<=i)return!1}return!0}function rt(n,e){let t=JSON.stringify(n);if(e.options.doubleQuotedAsJSON)return t;let{implicitKey:i}=e,r=e.options.doubleQuotedMinMultiLineLength,s=e.indent||(qt(n)?"  ":""),o="",a=0;for(let c=0,l=t[c];l;l=t[++c])if(l===" "&&t[c+1]==="\\"&&t[c+2]==="n"&&(o+=t.slice(a,c)+"\\ ",c+=1,a=c,l="\\"),l==="\\")switch(t[c+1]){case"u":{o+=t.slice(a,c);let f=t.substr(c+2,4);switch(f){case"0000":o+="\\0";break;case"0007":o+="\\a";break;case"000b":o+="\\v";break;case"001b":o+="\\e";break;case"0085":o+="\\N";break;case"00a0":o+="\\_";break;case"2028":o+="\\L";break;case"2029":o+="\\P";break;default:f.substr(0,2)==="00"?o+="\\x"+f.substr(2):o+=t.substr(c,6)}c+=5,a=c+1}break;case"n":if(i||t[c+2]==='"'||t.length<r)c+=1;else{for(o+=t.slice(a,c)+`

`;t[c+2]==="\\"&&t[c+3]==="n"&&t[c+4]!=='"';)o+=`
`,c+=2;o+=s,t[c+2]===" "&&(o+="\\"),c+=1,a=c+1}break;default:c+=1}return o=a?o+t.slice(a):t,i?o:it(o,s,nt,Pt(e,!1))}function vn(n,e){if(e.options.singleQuote===!1||e.implicitKey&&n.includes(`
`)||/[ \t]\n|\n[ \t]/.test(n))return rt(n,e);let t=e.indent||(qt(n)?"  ":""),i="'"+n.replace(/'/g,"''").replace(/\n+/g,`$&
${t}`)+"'";return e.implicitKey?i:it(i,t,$n,Pt(e,!1))}function Fe(n,e){let{singleQuote:t}=e.options,i;if(t===!1)i=rt;else{let r=n.includes('"'),s=n.includes("'");r&&!s?i=vn:s&&!r?i=rt:i=t?vn:rt}return i(n,e)}var Sn;try{Sn=new RegExp(`(^|(?<!
))
+(?!
|$)`,"g")}catch{Sn=/\n+(?!\n|$)/g}function It({comment:n,type:e,value:t},i,r,s){let{blockQuote:o,commentString:a,lineWidth:c}=i.options;if(!o||/\n[\t ]+$/.test(t))return Fe(t,i);let l=i.indent||(i.forceBlockIndent||qt(t)?"  ":""),f=o==="literal"?!0:o==="folded"||e===v.BLOCK_FOLDED?!1:e===v.BLOCK_LITERAL?!0:!Nr(t,c,l.length);if(!t)return f?`|
`:`>
`;let p,m;for(m=t.length;m>0;--m){let S=t[m-1];if(S!==`
`&&S!=="	"&&S!==" ")break}let u=t.substring(m),g=u.indexOf(`
`);g===-1?p="-":t===u||g!==u.length-1?(p="+",s&&s()):p="",u&&(t=t.slice(0,-u.length),u[u.length-1]===`
`&&(u=u.slice(0,-1)),u=u.replace(Sn,`$&${l}`));let h=!1,x,y=-1;for(x=0;x<t.length;++x){let S=t[x];if(S===" ")h=!0;else if(S===`
`)y=x;else break}let b=t.substring(0,y<x?y+1:x);b&&(t=t.substring(b.length),b=b.replace(/\n+/g,`$&${l}`));let d=(h?l?"2":"1":"")+p;if(n&&(d+=" "+a(n.replace(/ ?[\r\n]+/g," ")),r&&r()),!f){let S=t.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,"$1$2").replace(/\n+/g,`$&${l}`),A=!1,I=Pt(i,!0);o!=="folded"&&e!==v.BLOCK_FOLDED&&(I.onOverflow=()=>{A=!0});let k=it(`${b}${S}${u}`,l,Ct,I);if(!A)return`>${d}
${l}${k}`}return t=t.replace(/\n+/g,`$&${l}`),`|${d}
${l}${b}${t}${u}`}function Rr(n,e,t,i){let{type:r,value:s}=n,{actualString:o,implicitKey:a,indent:c,indentStep:l,inFlow:f}=e;if(a&&s.includes(`
`)||f&&/[[\]{},]/.test(s))return Fe(s,e);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(s))return a||f||!s.includes(`
`)?Fe(s,e):It(n,e,t,i);if(!a&&!f&&r!==v.PLAIN&&s.includes(`
`))return It(n,e,t,i);if(qt(s)){if(c==="")return e.forceBlockIndent=!0,It(n,e,t,i);if(a&&c===l)return Fe(s,e)}let p=s.replace(/\n+/g,`$&
${c}`);if(o){let m=h=>h.default&&h.tag!=="tag:yaml.org,2002:str"&&h.test?.test(p),{compat:u,tags:g}=e.doc.schema;if(g.some(m)||u?.some(m))return Fe(s,e)}return a?p:it(p,c,$n,Pt(e,!1))}function Le(n,e,t,i){let{implicitKey:r,inFlow:s}=e,o=typeof n.value=="string"?n:Object.assign({},n,{value:String(n.value)}),{type:a}=n;a!==v.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(o.value)&&(a=v.QUOTE_DOUBLE);let c=f=>{switch(f){case v.BLOCK_FOLDED:case v.BLOCK_LITERAL:return r||s?Fe(o.value,e):It(o,e,t,i);case v.QUOTE_DOUBLE:return rt(o.value,e);case v.QUOTE_SINGLE:return vn(o.value,e);case v.PLAIN:return Rr(o,e,t,i);default:return null}},l=c(a);if(l===null){let{defaultKeyType:f,defaultStringType:p}=e.options,m=r&&f||p;if(l=c(m),l===null)throw new Error(`Unsupported default string type ${m}`)}return l}function Lt(n,e){let t=Object.assign({blockQuote:!0,commentString:fi,defaultKeyType:null,defaultStringType:"PLAIN",directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:"false",flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:"null",simpleKeys:!1,singleQuote:null,trueStr:"true",verifyAliasOrder:!0},n.schema.toStringOptions,e),i;switch(t.collectionStyle){case"block":i=!1;break;case"flow":i=!0;break;default:i=null}return{anchors:new Set,doc:n,flowCollectionPadding:t.flowCollectionPadding?" ":"",indent:"",indentStep:typeof t.indent=="number"?" ".repeat(t.indent):"  ",inFlow:i,options:t}}function _r(n,e){if(e.tag){let r=n.filter(s=>s.tag===e.tag);if(r.length>0)return r.find(s=>s.format===e.format)??r[0]}let t,i;if(j(e)){i=e.value;let r=n.filter(s=>s.identify?.(i));if(r.length>1){let s=r.filter(o=>o.test);s.length>0&&(r=s)}t=r.find(s=>s.format===e.format)??r.find(s=>!s.format)}else i=e,t=n.find(r=>r.nodeClass&&i instanceof r.nodeClass);if(!t){let r=i?.constructor?.name??(i===null?"null":typeof i);throw new Error(`Tag not resolved for ${r} value`)}return t}function zr(n,e,{anchors:t,doc:i}){if(!i.directives)return"";let r=[],s=(j(n)||q(n))&&n.anchor;s&&jt(s)&&(t.add(s),r.push(`&${s}`));let o=n.tag??(e.default?null:e.tag);return o&&r.push(i.directives.tagString(o)),r.join(" ")}function ke(n,e,t,i){if(E(n))return n.toString(e,t,i);if(X(n)){if(e.doc.directives)return n.toString(e);if(e.resolvedAliases?.has(n))throw new TypeError("Cannot stringify circular structure without alias nodes");e.resolvedAliases?e.resolvedAliases.add(n):e.resolvedAliases=new Set([n]),n=n.resolve(e.doc)}let r,s=C(n)?n:e.doc.createNode(n,{onTagObj:c=>r=c});r??(r=_r(e.doc.schema.tags,s));let o=zr(s,r,e);o.length>0&&(e.indentAtStart=(e.indentAtStart??0)+o.length+1);let a=typeof r.stringify=="function"?r.stringify(s,e,t,i):j(s)?Le(s,e,t,i):s.toString(e,t,i);return o?j(s)||a[0]==="{"||a[0]==="["?`${o} ${a}`:`${o}
${e.indent}${a}`:a}function mi({key:n,value:e},t,i,r){let{allNullValues:s,doc:o,indent:a,indentStep:c,options:{commentString:l,indentSeq:f,simpleKeys:p}}=t,m=C(n)&&n.comment||null;if(p){if(m)throw new Error("With simple keys, key nodes cannot have comments");if(q(n)||!C(n)&&typeof n=="object"){let I="With simple keys, collection cannot be used as a key value";throw new Error(I)}}let u=!p&&(!n||m&&e==null&&!t.inFlow||q(n)||(j(n)?n.type===v.BLOCK_FOLDED||n.type===v.BLOCK_LITERAL:typeof n=="object"));t=Object.assign({},t,{allNullValues:!1,implicitKey:!u&&(p||!s),indent:a+c});let g=!1,h=!1,x=ke(n,t,()=>g=!0,()=>h=!0);if(!u&&!t.inFlow&&x.length>1024){if(p)throw new Error("With simple keys, single line scalar must not span more than 1024 characters");u=!0}if(t.inFlow){if(s||e==null)return g&&i&&i(),x===""?"?":u?`? ${x}`:x}else if(s&&!p||e==null&&u)return x=`? ${x}`,m&&!g?x+=me(x,t.indent,l(m)):h&&r&&r(),x;g&&(m=null),u?(m&&(x+=me(x,t.indent,l(m))),x=`? ${x}
${a}:`):(x=`${x}:`,m&&(x+=me(x,t.indent,l(m))));let y,b,$;C(e)?(y=!!e.spaceBefore,b=e.commentBefore,$=e.comment):(y=!1,b=null,$=null,e&&typeof e=="object"&&(e=o.createNode(e))),t.implicitKey=!1,!u&&!m&&j(e)&&(t.indentAtStart=x.length+1),h=!1,!f&&c.length>=2&&!t.inFlow&&!u&&ie(e)&&!e.flow&&!e.tag&&!e.anchor&&(t.indent=t.indent.substring(2));let d=!1,S=ke(e,t,()=>d=!0,()=>h=!0),A=" ";if(m||y||b){if(A=y?`
`:"",b){let I=l(b);A+=`
${Z(I,t.indent)}`}S===""&&!t.inFlow?A===`
`&&$&&(A=`

`):A+=`
${t.indent}`}else if(!u&&q(e)){let I=S[0],k=S.indexOf(`
`),w=k!==-1,P=t.inFlow??e.flow??e.items.length===0;if(w||!P){let O=!1;if(w&&(I==="&"||I==="!")){let L=S.indexOf(" ");I==="&"&&L!==-1&&L<k&&S[L+1]==="!"&&(L=S.indexOf(" ",L+1)),(L===-1||k<L)&&(O=!0)}O||(A=`
${t.indent}`)}}else(S===""||S[0]===`
`)&&(A="");return x+=A+S,t.inFlow?d&&i&&i():$&&!d?x+=me(x,t.indent,l($)):h&&r&&r(),x}function Nt(n,e){(n==="debug"||n==="warn")&&console.warn(e)}var Rt="<<",re={identify:n=>n===Rt||typeof n=="symbol"&&n.description===Rt,default:"key",tag:"tag:yaml.org,2002:merge",test:/^<<$/,resolve:()=>Object.assign(new v(Symbol(Rt)),{addToJSMap:Tn}),stringify:()=>Rt},hi=(n,e)=>(re.identify(e)||j(e)&&(!e.type||e.type===v.PLAIN)&&re.identify(e.value))&&n?.doc.schema.tags.some(t=>t.tag===re.tag&&t.default);function Tn(n,e,t){if(t=n&&X(t)?t.resolve(n.doc):t,ie(t))for(let i of t.items)An(n,e,i);else if(Array.isArray(t))for(let i of t)An(n,e,i);else An(n,e,t)}function An(n,e,t){let i=n&&X(t)?t.resolve(n.doc):t;if(!ne(i))throw new Error("Merge sources must be maps or map aliases");let r=i.toJSON(null,n,Map);for(let[s,o]of r)e instanceof Map?e.has(s)||e.set(s,o):e instanceof Set?e.add(s):Object.prototype.hasOwnProperty.call(e,s)||Object.defineProperty(e,s,{value:o,writable:!0,enumerable:!0,configurable:!0});return e}function _t(n,e,{key:t,value:i}){if(C(t)&&t.addToJSMap)t.addToJSMap(n,e,i);else if(hi(n,t))Tn(n,e,i);else{let r=B(t,"",n);if(e instanceof Map)e.set(r,B(i,r,n));else if(e instanceof Set)e.add(r);else{let s=Dr(t,r,n),o=B(i,s,n);s in e?Object.defineProperty(e,s,{value:o,writable:!0,enumerable:!0,configurable:!0}):e[s]=o}}return e}function Dr(n,e,t){if(e===null)return"";if(typeof e!="object")return String(e);if(C(n)&&t?.doc){let i=Lt(t.doc,{});i.anchors=new Set;for(let s of t.anchors.keys())i.anchors.add(s.anchor);i.inFlow=!0,i.inStringifyKey=!0;let r=n.toString(i);if(!t.mapKeyWarned){let s=JSON.stringify(r);s.length>40&&(s=s.substring(0,36)+'..."'),Nt(t.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${s}. Set mapAsMap: true to use object keys.`),t.mapKeyWarned=!0}return r}return JSON.stringify(e)}function Je(n,e,t){let i=we(n,void 0,t),r=we(e,void 0,t);return new R(i,r)}var R=class n{constructor(e,t=null){Object.defineProperty(this,V,{value:xn}),this.key=e,this.value=t}clone(e){let{key:t,value:i}=this;return C(t)&&(t=t.clone(e)),C(i)&&(i=i.clone(e)),new n(t,i)}toJSON(e,t){let i=t?.mapAsMap?new Map:{};return _t(t,i,this)}toString(e,t,i){return e?.doc?mi(this,e,t,i):JSON.stringify(this)}};function Dt(n,e,t){return(e.inFlow??n.flow?Mr:Br)(n,e,t)}function Br({comment:n,items:e},t,{blockItemPrefix:i,flowChars:r,itemIndent:s,onChompKeep:o,onComment:a}){let{indent:c,options:{commentString:l}}=t,f=Object.assign({},t,{indent:s,type:null}),p=!1,m=[];for(let g=0;g<e.length;++g){let h=e[g],x=null;if(C(h))!p&&h.spaceBefore&&m.push(""),zt(t,m,h.commentBefore,p),h.comment&&(x=h.comment);else if(E(h)){let b=C(h.key)?h.key:null;b&&(!p&&b.spaceBefore&&m.push(""),zt(t,m,b.commentBefore,p))}p=!1;let y=ke(h,f,()=>x=null,()=>p=!0);x&&(y+=me(y,s,l(x))),p&&x&&(p=!1),m.push(i+y)}let u;if(m.length===0)u=r.start+r.end;else{u=m[0];for(let g=1;g<m.length;++g){let h=m[g];u+=h?`
${c}${h}`:`
`}}return n?(u+=`
`+Z(l(n),c),a&&a()):p&&o&&o(),u}function Mr({items:n},e,{flowChars:t,itemIndent:i}){let{indent:r,indentStep:s,flowCollectionPadding:o,options:{commentString:a}}=e;i+=s;let c=Object.assign({},e,{indent:i,inFlow:!0,type:null}),l=!1,f=0,p=[];for(let g=0;g<n.length;++g){let h=n[g],x=null;if(C(h))h.spaceBefore&&p.push(""),zt(e,p,h.commentBefore,!1),h.comment&&(x=h.comment);else if(E(h)){let b=C(h.key)?h.key:null;b&&(b.spaceBefore&&p.push(""),zt(e,p,b.commentBefore,!1),b.comment&&(l=!0));let $=C(h.value)?h.value:null;$?($.comment&&(x=$.comment),$.commentBefore&&(l=!0)):h.value==null&&b?.comment&&(x=b.comment)}x&&(l=!0);let y=ke(h,c,()=>x=null);g<n.length-1&&(y+=","),x&&(y+=me(y,i,a(x))),!l&&(p.length>f||y.includes(`
`))&&(l=!0),p.push(y),f=p.length}let{start:m,end:u}=t;if(p.length===0)return m+u;if(!l){let g=p.reduce((h,x)=>h+x.length+2,2);l=e.options.lineWidth>0&&g>e.options.lineWidth}if(l){let g=m;for(let h of p)g+=h?`
${s}${r}${h}`:`
`;return`${g}
${r}${u}`}else return`${m}${o}${p.join(" ")}${o}${u}`}function zt({indent:n,options:{commentString:e}},t,i,r){if(i&&r&&(i=i.replace(/^\n+/,"")),i){let s=Z(e(i),n);t.push(s.trimStart())}}function Oe(n,e){let t=j(e)?e.value:e;for(let i of n)if(E(i)&&(i.key===e||i.key===t||j(i.key)&&i.key.value===t))return i}var _=class extends Ke{static get tagName(){return"tag:yaml.org,2002:map"}constructor(e){super(ee,e),this.items=[]}static from(e,t,i){let{keepUndefined:r,replacer:s}=i,o=new this(e),a=(c,l)=>{if(typeof s=="function")l=s.call(t,c,l);else if(Array.isArray(s)&&!s.includes(c))return;(l!==void 0||r)&&o.items.push(Je(c,l,i))};if(t instanceof Map)for(let[c,l]of t)a(c,l);else if(t&&typeof t=="object")for(let c of Object.keys(t))a(c,t[c]);return typeof e.sortMapEntries=="function"&&o.items.sort(e.sortMapEntries),o}add(e,t){let i;E(e)?i=e:!e||typeof e!="object"||!("key"in e)?i=new R(e,e?.value):i=new R(e.key,e.value);let r=Oe(this.items,i.key),s=this.schema?.sortMapEntries;if(r){if(!t)throw new Error(`Key ${i.key} already set`);j(r.value)&&Et(i.value)?r.value.value=i.value:r.value=i.value}else if(s){let o=this.items.findIndex(a=>s(i,a)<0);o===-1?this.items.push(i):this.items.splice(o,0,i)}else this.items.push(i)}delete(e){let t=Oe(this.items,e);return t?this.items.splice(this.items.indexOf(t),1).length>0:!1}get(e,t){let r=Oe(this.items,e)?.value;return(!t&&j(r)?r.value:r)??void 0}has(e){return!!Oe(this.items,e)}set(e,t){this.add(new R(e,t),!0)}toJSON(e,t,i){let r=i?new i:t?.mapAsMap?new Map:{};t?.onCreate&&t.onCreate(r);for(let s of this.items)_t(t,r,s);return r}toString(e,t,i){if(!e)return JSON.stringify(this);for(let r of this.items)if(!E(r))throw new Error(`Map items must all be pairs; found ${JSON.stringify(r)} instead`);return!e.allNullValues&&this.hasAllNullValues(!1)&&(e=Object.assign({},e,{allNullValues:!0})),Dt(this,e,{blockItemPrefix:"",flowChars:{start:"{",end:"}"},itemIndent:e.indent||"",onChompKeep:i,onComment:t})}};var se={collection:"map",default:!0,nodeClass:_,tag:"tag:yaml.org,2002:map",resolve(n,e){return ne(n)||e("Expected a mapping for this tag"),n},createNode:(n,e,t)=>_.from(n,e,t)};var U=class extends Ke{static get tagName(){return"tag:yaml.org,2002:seq"}constructor(e){super(be,e),this.items=[]}add(e){this.items.push(e)}delete(e){let t=Bt(e);return typeof t!="number"?!1:this.items.splice(t,1).length>0}get(e,t){let i=Bt(e);if(typeof i!="number")return;let r=this.items[i];return!t&&j(r)?r.value:r}has(e){let t=Bt(e);return typeof t=="number"&&t<this.items.length}set(e,t){let i=Bt(e);if(typeof i!="number")throw new Error(`Expected a valid index, not ${e}.`);let r=this.items[i];j(r)&&Et(t)?r.value=t:this.items[i]=t}toJSON(e,t){let i=[];t?.onCreate&&t.onCreate(i);let r=0;for(let s of this.items)i.push(B(s,String(r++),t));return i}toString(e,t,i){return e?Dt(this,e,{blockItemPrefix:"- ",flowChars:{start:"[",end:"]"},itemIndent:(e.indent||"")+"  ",onChompKeep:i,onComment:t}):JSON.stringify(this)}static from(e,t,i){let{replacer:r}=i,s=new this(e);if(t&&Symbol.iterator in Object(t)){let o=0;for(let a of t){if(typeof r=="function"){let c=t instanceof Set?a:String(o++);a=r.call(t,c,a)}s.items.push(we(a,void 0,i))}}return s}};function Bt(n){let e=j(n)?n.value:n;return e&&typeof e=="string"&&(e=Number(e)),typeof e=="number"&&Number.isInteger(e)&&e>=0?e:null}var oe={collection:"seq",default:!0,nodeClass:U,tag:"tag:yaml.org,2002:seq",resolve(n,e){return ie(n)||e("Expected a sequence for this tag"),n},createNode:(n,e,t)=>U.from(n,e,t)};var Ee={identify:n=>typeof n=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:n=>n,stringify(n,e,t,i){return e=Object.assign({actualString:!0},e),Le(n,e,t,i)}};var Ne={identify:n=>n==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new v(null),stringify:({source:n},e)=>typeof n=="string"&&Ne.test.test(n)?n:e.options.nullStr};var st={identify:n=>typeof n=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:n=>new v(n[0]==="t"||n[0]==="T"),stringify({source:n,value:e},t){if(n&&st.test.test(n)){let i=n[0]==="t"||n[0]==="T";if(e===i)return n}return e?t.options.trueStr:t.options.falseStr}};function K({format:n,minFractionDigits:e,tag:t,value:i}){if(typeof i=="bigint")return String(i);let r=typeof i=="number"?i:Number(i);if(!isFinite(r))return isNaN(r)?".nan":r<0?"-.inf":".inf";let s=Object.is(i,-0)?"-0":JSON.stringify(i);if(!n&&e&&(!t||t==="tag:yaml.org,2002:float")&&/^\d/.test(s)){let o=s.indexOf(".");o<0&&(o=s.length,s+=".");let a=e-(s.length-o-1);for(;a-- >0;)s+="0"}return s}var Mt={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:n=>n.slice(-3).toLowerCase()==="nan"?NaN:n[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:K},Ut={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:n=>parseFloat(n),stringify(n){let e=Number(n.value);return isFinite(e)?e.toExponential():K(n)}},Kt={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(n){let e=new v(parseFloat(n)),t=n.indexOf(".");return t!==-1&&n[n.length-1]==="0"&&(e.minFractionDigits=n.length-t-1),e},stringify:K};var Vt=n=>typeof n=="bigint"||Number.isInteger(n),jn=(n,e,t,{intAsBigInt:i})=>i?BigInt(n):parseInt(n.substring(e),t);function ui(n,e,t){let{value:i}=n;return Vt(i)&&i>=0?t+i.toString(e):K(n)}var Ft={identify:n=>Vt(n)&&n>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^0o[0-7]+$/,resolve:(n,e,t)=>jn(n,2,8,t),stringify:n=>ui(n,8,"0o")},Jt={identify:Vt,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9]+$/,resolve:(n,e,t)=>jn(n,0,10,t),stringify:K},Ht={identify:n=>Vt(n)&&n>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^0x[0-9a-fA-F]+$/,resolve:(n,e,t)=>jn(n,2,16,t),stringify:n=>ui(n,16,"0x")};var gi=[se,oe,Ee,Ne,st,Ft,Jt,Ht,Mt,Ut,Kt];function yi(n){return typeof n=="bigint"||Number.isInteger(n)}var Wt=({value:n})=>JSON.stringify(n),Ur=[{identify:n=>typeof n=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:n=>n,stringify:Wt},{identify:n=>n==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^null$/,resolve:()=>null,stringify:Wt},{identify:n=>typeof n=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^true$|^false$/,resolve:n=>n==="true",stringify:Wt},{identify:yi,default:!0,tag:"tag:yaml.org,2002:int",test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(n,e,{intAsBigInt:t})=>t?BigInt(n):parseInt(n,10),stringify:({value:n})=>yi(n)?n.toString():JSON.stringify(n)},{identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:n=>parseFloat(n),stringify:Wt}],Kr={default:!0,tag:"",test:/^/,resolve(n,e){return e(`Unresolved plain scalar ${JSON.stringify(n)}`),n}},bi=[se,oe].concat(Ur,Kr);var ot={identify:n=>n instanceof Uint8Array,default:!1,tag:"tag:yaml.org,2002:binary",resolve(n,e){if(typeof atob=="function"){let t=atob(n.replace(/[\n\r]/g,"")),i=new Uint8Array(t.length);for(let r=0;r<t.length;++r)i[r]=t.charCodeAt(r);return i}else return e("This environment does not support reading binary tags; either Buffer or atob is required"),n},stringify({comment:n,type:e,value:t},i,r,s){if(!t)return"";let o=t,a;if(typeof btoa=="function"){let c="";for(let l=0;l<o.length;++l)c+=String.fromCharCode(o[l]);a=btoa(c)}else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");if(e??(e=v.BLOCK_LITERAL),e!==v.QUOTE_DOUBLE){let c=Math.max(i.options.lineWidth-i.indent.length,i.options.minContentWidth),l=Math.ceil(a.length/c),f=new Array(l);for(let p=0,m=0;p<l;++p,m+=c)f[p]=a.substr(m,c);a=f.join(e===v.BLOCK_LITERAL?`
`:" ")}return Le({comment:n,type:e,value:a},i,r,s)}};function On(n,e){if(ie(n))for(let t=0;t<n.items.length;++t){let i=n.items[t];if(!E(i)){if(ne(i)){i.items.length>1&&e("Each pair must have its own sequence indicator");let r=i.items[0]||new R(new v(null));if(i.commentBefore&&(r.key.commentBefore=r.key.commentBefore?`${i.commentBefore}
${r.key.commentBefore}`:i.commentBefore),i.comment){let s=r.value??r.key;s.comment=s.comment?`${i.comment}
${s.comment}`:i.comment}i=r}n.items[t]=E(i)?i:new R(i)}}else e("Expected a sequence for this tag");return n}function En(n,e,t){let{replacer:i}=t,r=new U(n);r.tag="tag:yaml.org,2002:pairs";let s=0;if(e&&Symbol.iterator in Object(e))for(let o of e){typeof i=="function"&&(o=i.call(e,String(s++),o));let a,c;if(Array.isArray(o))if(o.length===2)a=o[0],c=o[1];else throw new TypeError(`Expected [key, value] tuple: ${o}`);else if(o&&o instanceof Object){let l=Object.keys(o);if(l.length===1)a=l[0],c=o[a];else throw new TypeError(`Expected tuple with one key, not ${l.length} keys`)}else a=o;r.items.push(Je(a,c,t))}return r}var at={collection:"seq",default:!1,tag:"tag:yaml.org,2002:pairs",resolve:On,createNode:En};var He=class n extends U{constructor(){super(),this.add=_.prototype.add.bind(this),this.delete=_.prototype.delete.bind(this),this.get=_.prototype.get.bind(this),this.has=_.prototype.has.bind(this),this.set=_.prototype.set.bind(this),this.tag=n.tag}toJSON(e,t){if(!t)return super.toJSON(e);let i=new Map;t?.onCreate&&t.onCreate(i);for(let r of this.items){let s,o;if(E(r)?(s=B(r.key,"",t),o=B(r.value,s,t)):s=B(r,"",t),i.has(s))throw new Error("Ordered maps must not include duplicate keys");i.set(s,o)}return i}static from(e,t,i){let r=En(e,t,i),s=new this;return s.items=r.items,s}};He.tag="tag:yaml.org,2002:omap";var ct={collection:"seq",identify:n=>n instanceof Map,nodeClass:He,default:!1,tag:"tag:yaml.org,2002:omap",resolve(n,e){let t=On(n,e),i=[];for(let{key:r}of t.items)j(r)&&(i.includes(r.value)?e(`Ordered maps must not include duplicate keys: ${r.value}`):i.push(r.value));return Object.assign(new He,t)},createNode:(n,e,t)=>He.from(n,e,t)};function xi({value:n,source:e},t){return e&&(n?Cn:In).test.test(e)?e:n?t.options.trueStr:t.options.falseStr}var Cn={identify:n=>n===!0,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new v(!0),stringify:xi},In={identify:n=>n===!1,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new v(!1),stringify:xi};var wi={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:n=>n.slice(-3).toLowerCase()==="nan"?NaN:n[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:K},ki={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:n=>parseFloat(n.replace(/_/g,"")),stringify(n){let e=Number(n.value);return isFinite(e)?e.toExponential():K(n)}},$i={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(n){let e=new v(parseFloat(n.replace(/_/g,""))),t=n.indexOf(".");if(t!==-1){let i=n.substring(t+1).replace(/_/g,"");i[i.length-1]==="0"&&(e.minFractionDigits=i.length)}return e},stringify:K};var lt=n=>typeof n=="bigint"||Number.isInteger(n);function Gt(n,e,t,{intAsBigInt:i}){let r=n[0];if((r==="-"||r==="+")&&(e+=1),n=n.substring(e).replace(/_/g,""),i){switch(t){case 2:n=`0b${n}`;break;case 8:n=`0o${n}`;break;case 16:n=`0x${n}`;break}let o=BigInt(n);return r==="-"?BigInt(-1)*o:o}let s=parseInt(n,t);return r==="-"?-1*s:s}function Pn(n,e,t){let{value:i}=n;if(lt(i)){let r=i.toString(e);return i<0?"-"+t+r.substr(1):t+r}return K(n)}var vi={identify:lt,default:!0,tag:"tag:yaml.org,2002:int",format:"BIN",test:/^[-+]?0b[0-1_]+$/,resolve:(n,e,t)=>Gt(n,2,2,t),stringify:n=>Pn(n,2,"0b")},Si={identify:lt,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^[-+]?0[0-7_]+$/,resolve:(n,e,t)=>Gt(n,1,8,t),stringify:n=>Pn(n,8,"0")},Ai={identify:lt,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9][0-9_]*$/,resolve:(n,e,t)=>Gt(n,0,10,t),stringify:K},Ti={identify:lt,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(n,e,t)=>Gt(n,2,16,t),stringify:n=>Pn(n,16,"0x")};var We=class n extends _{constructor(e){super(e),this.tag=n.tag}add(e){let t;E(e)?t=e:e&&typeof e=="object"&&"key"in e&&"value"in e&&e.value===null?t=new R(e.key,null):t=new R(e,null),Oe(this.items,t.key)||this.items.push(t)}get(e,t){let i=Oe(this.items,e);return!t&&E(i)?j(i.key)?i.key.value:i.key:i}set(e,t){if(typeof t!="boolean")throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof t}`);let i=Oe(this.items,e);i&&!t?this.items.splice(this.items.indexOf(i),1):!i&&t&&this.items.push(new R(e))}toJSON(e,t){return super.toJSON(e,t,Set)}toString(e,t,i){if(!e)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},e,{allNullValues:!0}),t,i);throw new Error("Set items must all have null values")}static from(e,t,i){let{replacer:r}=i,s=new this(e);if(t&&Symbol.iterator in Object(t))for(let o of t)typeof r=="function"&&(o=r.call(t,o,o)),s.items.push(Je(o,null,i));return s}};We.tag="tag:yaml.org,2002:set";var pt={collection:"map",identify:n=>n instanceof Set,nodeClass:We,default:!1,tag:"tag:yaml.org,2002:set",createNode:(n,e,t)=>We.from(n,e,t),resolve(n,e){if(ne(n)){if(n.hasAllNullValues(!0))return Object.assign(new We,n);e("Set items must all have null values")}else e("Expected a mapping for this tag");return n}};function qn(n,e){let t=n[0],i=t==="-"||t==="+"?n.substring(1):n,r=o=>e?BigInt(o):Number(o),s=i.replace(/_/g,"").split(":").reduce((o,a)=>o*r(60)+r(a),r(0));return t==="-"?r(-1)*s:s}function ji(n){let{value:e}=n,t=o=>o;if(typeof e=="bigint")t=o=>BigInt(o);else if(isNaN(e)||!isFinite(e))return K(n);let i="";e<0&&(i="-",e*=t(-1));let r=t(60),s=[e%r];return e<60?s.unshift(0):(e=(e-s[0])/r,s.unshift(e%r),e>=60&&(e=(e-s[0])/r,s.unshift(e))),i+s.map(o=>String(o).padStart(2,"0")).join(":").replace(/000000\d*$/,"")}var Yt={identify:n=>typeof n=="bigint"||Number.isInteger(n),default:!0,tag:"tag:yaml.org,2002:int",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(n,e,{intAsBigInt:t})=>qn(n,t),stringify:ji},Qt={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:n=>qn(n,!1),stringify:ji},Ge={identify:n=>n instanceof Date,default:!0,tag:"tag:yaml.org,2002:timestamp",test:RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),resolve(n){let e=n.match(Ge.test);if(!e)throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");let[,t,i,r,s,o,a]=e.map(Number),c=e[7]?Number((e[7]+"00").substr(1,3)):0,l=Date.UTC(t,i-1,r,s||0,o||0,a||0,c),f=e[8];if(f&&f!=="Z"){let p=qn(f,!1);Math.abs(p)<30&&(p*=60),l-=6e4*p}return new Date(l)},stringify:({value:n})=>n?.toISOString().replace(/(T00:00:00)?\.000Z$/,"")??""};var Ln=[se,oe,Ee,Ne,Cn,In,vi,Si,Ai,Ti,wi,ki,$i,ot,re,ct,at,pt,Yt,Qt,Ge];var Oi=new Map([["core",gi],["failsafe",[se,oe,Ee]],["json",bi],["yaml11",Ln],["yaml-1.1",Ln]]),Ei={binary:ot,bool:st,float:Kt,floatExp:Ut,floatNaN:Mt,floatTime:Qt,int:Jt,intHex:Ht,intOct:Ft,intTime:Yt,map:se,merge:re,null:Ne,omap:ct,pairs:at,seq:oe,set:pt,timestamp:Ge},Ci={"tag:yaml.org,2002:binary":ot,"tag:yaml.org,2002:merge":re,"tag:yaml.org,2002:omap":ct,"tag:yaml.org,2002:pairs":at,"tag:yaml.org,2002:set":pt,"tag:yaml.org,2002:timestamp":Ge};function Xt(n,e,t){let i=Oi.get(e);if(i&&!n)return t&&!i.includes(re)?i.concat(re):i.slice();let r=i;if(!r)if(Array.isArray(n))r=[];else{let s=Array.from(Oi.keys()).filter(o=>o!=="yaml11").map(o=>JSON.stringify(o)).join(", ");throw new Error(`Unknown schema "${e}"; use one of ${s} or define customTags array`)}if(Array.isArray(n))for(let s of n)r=r.concat(s);else typeof n=="function"&&(r=n(r.slice()));return t&&(r=r.concat(re)),r.reduce((s,o)=>{let a=typeof o=="string"?Ei[o]:o;if(!a){let c=JSON.stringify(o),l=Object.keys(Ei).map(f=>JSON.stringify(f)).join(", ");throw new Error(`Unknown custom tag ${c}; use one of ${l}`)}return s.includes(a)||s.push(a),s},[])}var Vr=(n,e)=>n.key<e.key?-1:n.key>e.key?1:0,ft=class n{constructor({compat:e,customTags:t,merge:i,resolveKnownTags:r,schema:s,sortMapEntries:o,toStringDefaults:a}){this.compat=Array.isArray(e)?Xt(e,"compat"):e?Xt(null,e):null,this.name=typeof s=="string"&&s||"core",this.knownTags=r?Ci:{},this.tags=Xt(t,this.name,i),this.toStringOptions=a??null,Object.defineProperty(this,ee,{value:se}),Object.defineProperty(this,Q,{value:Ee}),Object.defineProperty(this,be,{value:oe}),this.sortMapEntries=typeof o=="function"?o:o===!0?Vr:null}clone(){let e=Object.create(n.prototype,Object.getOwnPropertyDescriptors(this));return e.tags=this.tags.slice(),e}};function Ii(n,e){let t=[],i=e.directives===!0;if(e.directives!==!1&&n.directives){let c=n.directives.toString(n);c?(t.push(c),i=!0):n.directives.docStart&&(i=!0)}i&&t.push("---");let r=Lt(n,e),{commentString:s}=r.options;if(n.commentBefore){t.length!==1&&t.unshift("");let c=s(n.commentBefore);t.unshift(Z(c,""))}let o=!1,a=null;if(n.contents){if(C(n.contents)){if(n.contents.spaceBefore&&i&&t.push(""),n.contents.commentBefore){let f=s(n.contents.commentBefore);t.push(Z(f,""))}r.forceBlockIndent=!!n.comment,a=n.contents.comment}let c=a?void 0:()=>o=!0,l=ke(n.contents,r,()=>a=null,c);a&&(l+=me(l,"",s(a))),(l[0]==="|"||l[0]===">")&&t[t.length-1]==="---"?t[t.length-1]=`--- ${l}`:t.push(l)}else t.push(ke(n.contents,r));if(n.directives?.docEnd)if(n.comment){let c=s(n.comment);c.includes(`
`)?(t.push("..."),t.push(Z(c,""))):t.push(`... ${c}`)}else t.push("...");else{let c=n.comment;c&&o&&(c=c.replace(/^\n+/,"")),c&&((!o||a)&&t[t.length-1]!==""&&t.push(""),t.push(Z(s(c),"")))}return t.join(`
`)+`
`}var $e=class n{constructor(e,t,i){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,V,{value:St});let r=null;typeof t=="function"||Array.isArray(t)?r=t:i===void 0&&t&&(i=t,t=void 0);let s=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:"warn",prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:"1.2"},i);this.options=s;let{version:o}=s;i?._directives?(this.directives=i._directives.atDocument(),this.directives.yaml.explicit&&(o=this.directives.yaml.version)):this.directives=new de({version:o}),this.setSchema(o,i),this.contents=e===void 0?null:this.createNode(e,r,i)}clone(){let e=Object.create(n.prototype,{[V]:{value:St}});return e.commentBefore=this.commentBefore,e.comment=this.comment,e.errors=this.errors.slice(),e.warnings=this.warnings.slice(),e.options=Object.assign({},this.options),this.directives&&(e.directives=this.directives.clone()),e.schema=this.schema.clone(),e.contents=C(this.contents)?this.contents.clone(e.schema):this.contents,this.range&&(e.range=this.range.slice()),e}add(e){Ye(this.contents)&&this.contents.add(e)}addIn(e,t){Ye(this.contents)&&this.contents.addIn(e,t)}createAlias(e,t){if(!e.anchor){let i=wn(this);e.anchor=!t||i.has(t)?kn(t||"a",i):t}return new xe(e.anchor)}createNode(e,t,i){let r;if(typeof t=="function")e=t.call({"":e},"",e),r=t;else if(Array.isArray(t)){let x=b=>typeof b=="number"||b instanceof String||b instanceof Number,y=t.filter(x).map(String);y.length>0&&(t=t.concat(y)),r=t}else i===void 0&&t&&(i=t,t=void 0);let{aliasDuplicateObjects:s,anchorPrefix:o,flow:a,keepUndefined:c,onTagObj:l,tag:f}=i??{},{onAnchor:p,setAnchors:m,sourceObjects:u}=pi(this,o||"a"),g={aliasDuplicateObjects:s??!0,keepUndefined:c??!1,onAnchor:p,onTagObj:l,replacer:r,schema:this.schema,sourceObjects:u},h=we(e,f,g);return a&&q(h)&&(h.flow=!0),m(),h}createPair(e,t,i={}){let r=this.createNode(e,null,i),s=this.createNode(t,null,i);return new R(r,s)}delete(e){return Ye(this.contents)?this.contents.delete(e):!1}deleteIn(e){return Ve(e)?this.contents==null?!1:(this.contents=null,!0):Ye(this.contents)?this.contents.deleteIn(e):!1}get(e,t){return q(this.contents)?this.contents.get(e,t):void 0}getIn(e,t){return Ve(e)?!t&&j(this.contents)?this.contents.value:this.contents:q(this.contents)?this.contents.getIn(e,t):void 0}has(e){return q(this.contents)?this.contents.has(e):!1}hasIn(e){return Ve(e)?this.contents!==void 0:q(this.contents)?this.contents.hasIn(e):!1}set(e,t){this.contents==null?this.contents=tt(this.schema,[e],t):Ye(this.contents)&&this.contents.set(e,t)}setIn(e,t){Ve(e)?this.contents=t:this.contents==null?this.contents=tt(this.schema,Array.from(e),t):Ye(this.contents)&&this.contents.setIn(e,t)}setSchema(e,t={}){typeof e=="number"&&(e=String(e));let i;switch(e){case"1.1":this.directives?this.directives.yaml.version="1.1":this.directives=new de({version:"1.1"}),i={resolveKnownTags:!1,schema:"yaml-1.1"};break;case"1.2":case"next":this.directives?this.directives.yaml.version=e:this.directives=new de({version:e}),i={resolveKnownTags:!0,schema:"core"};break;case null:this.directives&&delete this.directives,i=null;break;default:{let r=JSON.stringify(e);throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${r}`)}}if(t.schema instanceof Object)this.schema=t.schema;else if(i)this.schema=new ft(Object.assign(i,t));else throw new Error("With a null YAML version, the { schema: Schema } option is required")}toJS({json:e,jsonArg:t,mapAsMap:i,maxAliasCount:r,onAnchor:s,reviver:o}={}){let a={anchors:new Map,doc:this,keep:!e,mapAsMap:i===!0,mapKeyWarned:!1,maxAliasCount:typeof r=="number"?r:100},c=B(this.contents,t??"",a);if(typeof s=="function")for(let{count:l,res:f}of a.anchors.values())s(f,l);return typeof o=="function"?Te(o,{"":c},"",c):c}toJSON(e,t){return this.toJS({json:!0,jsonArg:e,mapAsMap:!1,onAnchor:t})}toString(e={}){if(this.errors.length>0)throw new Error("Document with errors cannot be stringified");if("indent"in e&&(!Number.isInteger(e.indent)||Number(e.indent)<=0)){let t=JSON.stringify(e.indent);throw new Error(`"indent" option must be a positive integer, not ${t}`)}return Ii(this,e)}};function Ye(n){if(q(n))return!0;throw new Error("Expected a YAML collection as document contents")}var dt=class extends Error{constructor(e,t,i,r){super(),this.name=e,this.code=i,this.message=r,this.pos=t}},ae=class extends dt{constructor(e,t,i){super("YAMLParseError",e,t,i)}},mt=class extends dt{constructor(e,t,i){super("YAMLWarning",e,t,i)}},Nn=(n,e)=>t=>{if(t.pos[0]===-1)return;t.linePos=t.pos.map(a=>e.linePos(a));let{line:i,col:r}=t.linePos[0];t.message+=` at line ${i}, column ${r}`;let s=r-1,o=n.substring(e.lineStarts[i-1],e.lineStarts[i]).replace(/[\n\r]+$/,"");if(s>=60&&o.length>80){let a=Math.min(s-39,o.length-79);o="\u2026"+o.substring(a),s-=a-1}if(o.length>80&&(o=o.substring(0,79)+"\u2026"),i>1&&/^ *$/.test(o.substring(0,s))){let a=n.substring(e.lineStarts[i-2],e.lineStarts[i-1]);a.length>80&&(a=a.substring(0,79)+`\u2026
`),o=a+o}if(/[^ ]/.test(o)){let a=1,c=t.linePos[1];c?.line===i&&c.col>r&&(a=Math.max(1,Math.min(c.col-r,80-s)));let l=" ".repeat(s)+"^".repeat(a);t.message+=`:

${o}
${l}
`}};function he(n,{flow:e,indicator:t,next:i,offset:r,onError:s,parentIndent:o,startOnNewline:a}){let c=!1,l=a,f=a,p="",m="",u=!1,g=!1,h=null,x=null,y=null,b=null,$=null,d=null,S=null;for(let k of n)switch(g&&(k.type!=="space"&&k.type!=="newline"&&k.type!=="comma"&&s(k.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),g=!1),h&&(l&&k.type!=="comment"&&k.type!=="newline"&&s(h,"TAB_AS_INDENT","Tabs are not allowed as indentation"),h=null),k.type){case"space":!e&&(t!=="doc-start"||i?.type!=="flow-collection")&&k.source.includes("	")&&(h=k),f=!0;break;case"comment":{f||s(k,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");let w=k.source.substring(1)||" ";p?p+=m+w:p=w,m="",l=!1;break}case"newline":l?p?p+=k.source:(!d||t!=="seq-item-ind")&&(c=!0):m+=k.source,l=!0,u=!0,(x||y)&&(b=k),f=!0;break;case"anchor":x&&s(k,"MULTIPLE_ANCHORS","A node can have at most one anchor"),k.source.endsWith(":")&&s(k.offset+k.source.length-1,"BAD_ALIAS","Anchor ending in : is ambiguous",!0),x=k,S??(S=k.offset),l=!1,f=!1,g=!0;break;case"tag":{y&&s(k,"MULTIPLE_TAGS","A node can have at most one tag"),y=k,S??(S=k.offset),l=!1,f=!1,g=!0;break}case t:(x||y)&&s(k,"BAD_PROP_ORDER",`Anchors and tags must be after the ${k.source} indicator`),d&&s(k,"UNEXPECTED_TOKEN",`Unexpected ${k.source} in ${e??"collection"}`),d=k,l=t==="seq-item-ind"||t==="explicit-key-ind",f=!1;break;case"comma":if(e){$&&s(k,"UNEXPECTED_TOKEN",`Unexpected , in ${e}`),$=k,l=!1,f=!1;break}default:s(k,"UNEXPECTED_TOKEN",`Unexpected ${k.type} token`),l=!1,f=!1}let A=n[n.length-1],I=A?A.offset+A.source.length:r;return g&&i&&i.type!=="space"&&i.type!=="newline"&&i.type!=="comma"&&(i.type!=="scalar"||i.source!=="")&&s(i.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),h&&(l&&h.indent<=o||i?.type==="block-map"||i?.type==="block-seq")&&s(h,"TAB_AS_INDENT","Tabs are not allowed as indentation"),{comma:$,found:d,spaceBefore:c,comment:p,hasNewline:u,anchor:x,tag:y,newlineAfterProp:b,end:I,start:S??I}}function Ce(n){if(!n)return null;switch(n.type){case"alias":case"scalar":case"double-quoted-scalar":case"single-quoted-scalar":if(n.source.includes(`
`))return!0;if(n.end){for(let e of n.end)if(e.type==="newline")return!0}return!1;case"flow-collection":for(let e of n.items){for(let t of e.start)if(t.type==="newline")return!0;if(e.sep){for(let t of e.sep)if(t.type==="newline")return!0}if(Ce(e.key)||Ce(e.value))return!0}return!1;default:return!0}}function ht(n,e,t){if(e?.type==="flow-collection"){let i=e.end[0];i.indent===n&&(i.source==="]"||i.source==="}")&&Ce(e)&&t(i,"BAD_INDENT","Flow end indicator should be more indented than parent",!0)}}function Zt(n,e,t){let{uniqueKeys:i}=n.options;if(i===!1)return!1;let r=typeof i=="function"?i:(s,o)=>s===o||j(s)&&j(o)&&s.value===o.value;return e.some(s=>r(s.key,t))}var Pi="All mapping items must start at the same column";function qi({composeNode:n,composeEmptyNode:e},t,i,r,s){let o=s?.nodeClass??_,a=new o(t.schema);t.atRoot&&(t.atRoot=!1);let c=i.offset,l=null;for(let f of i.items){let{start:p,key:m,sep:u,value:g}=f,h=he(p,{indicator:"explicit-key-ind",next:m??u?.[0],offset:c,onError:r,parentIndent:i.indent,startOnNewline:!0}),x=!h.found;if(x){if(m&&(m.type==="block-seq"?r(c,"BLOCK_AS_IMPLICIT_KEY","A block sequence may not be used as an implicit map key"):"indent"in m&&m.indent!==i.indent&&r(c,"BAD_INDENT",Pi)),!h.anchor&&!h.tag&&!u){l=h.end,h.comment&&(a.comment?a.comment+=`
`+h.comment:a.comment=h.comment);continue}(h.newlineAfterProp||Ce(m))&&r(m??p[p.length-1],"MULTILINE_IMPLICIT_KEY","Implicit keys need to be on a single line")}else h.found?.indent!==i.indent&&r(c,"BAD_INDENT",Pi);t.atKey=!0;let y=h.end,b=m?n(t,m,h,r):e(t,y,p,null,h,r);t.schema.compat&&ht(i.indent,m,r),t.atKey=!1,Zt(t,a.items,b)&&r(y,"DUPLICATE_KEY","Map keys must be unique");let $=he(u??[],{indicator:"map-value-ind",next:g,offset:b.range[2],onError:r,parentIndent:i.indent,startOnNewline:!m||m.type==="block-scalar"});if(c=$.end,$.found){x&&(g?.type==="block-map"&&!$.hasNewline&&r(c,"BLOCK_AS_IMPLICIT_KEY","Nested mappings are not allowed in compact mappings"),t.options.strict&&h.start<$.found.offset-1024&&r(b.range,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit block mapping key"));let d=g?n(t,g,$,r):e(t,c,u,null,$,r);t.schema.compat&&ht(i.indent,g,r),c=d.range[2];let S=new R(b,d);t.options.keepSourceTokens&&(S.srcToken=f),a.items.push(S)}else{x&&r(b.range,"MISSING_CHAR","Implicit map keys need to be followed by map values"),$.comment&&(b.comment?b.comment+=`
`+$.comment:b.comment=$.comment);let d=new R(b);t.options.keepSourceTokens&&(d.srcToken=f),a.items.push(d)}}return l&&l<c&&r(l,"IMPOSSIBLE","Map comment with trailing content"),a.range=[i.offset,c,l??c],a}function Li({composeNode:n,composeEmptyNode:e},t,i,r,s){let o=s?.nodeClass??U,a=new o(t.schema);t.atRoot&&(t.atRoot=!1),t.atKey&&(t.atKey=!1);let c=i.offset,l=null;for(let{start:f,value:p}of i.items){let m=he(f,{indicator:"seq-item-ind",next:p,offset:c,onError:r,parentIndent:i.indent,startOnNewline:!0});if(!m.found)if(m.anchor||m.tag||p)p?.type==="block-seq"?r(m.end,"BAD_INDENT","All sequence items must start at the same column"):r(c,"MISSING_CHAR","Sequence item without - indicator");else{l=m.end,m.comment&&(a.comment=m.comment);continue}let u=p?n(t,p,m,r):e(t,m.end,f,null,m,r);t.schema.compat&&ht(i.indent,p,r),c=u.range[2],a.items.push(u)}return a.range=[i.offset,c,l??c],a}function ue(n,e,t,i){let r="";if(n){let s=!1,o="";for(let a of n){let{source:c,type:l}=a;switch(l){case"space":s=!0;break;case"comment":{t&&!s&&i(a,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");let f=c.substring(1)||" ";r?r+=o+f:r=f,o="";break}case"newline":r&&(o+=c),s=!0;break;default:i(a,"UNEXPECTED_TOKEN",`Unexpected ${l} at node end`)}e+=c.length}}return{comment:r,offset:e}}var Rn="Block collections are not allowed within flow collections",_n=n=>n&&(n.type==="block-map"||n.type==="block-seq");function Ni({composeNode:n,composeEmptyNode:e},t,i,r,s){let o=i.start.source==="{",a=o?"flow map":"flow sequence",c=s?.nodeClass??(o?_:U),l=new c(t.schema);l.flow=!0;let f=t.atRoot;f&&(t.atRoot=!1),t.atKey&&(t.atKey=!1);let p=i.offset+i.start.source.length;for(let x=0;x<i.items.length;++x){let y=i.items[x],{start:b,key:$,sep:d,value:S}=y,A=he(b,{flow:a,indicator:"explicit-key-ind",next:$??d?.[0],offset:p,onError:r,parentIndent:i.indent,startOnNewline:!1});if(!A.found){if(!A.anchor&&!A.tag&&!d&&!S){x===0&&A.comma?r(A.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`):x<i.items.length-1&&r(A.start,"UNEXPECTED_TOKEN",`Unexpected empty item in ${a}`),A.comment&&(l.comment?l.comment+=`
`+A.comment:l.comment=A.comment),p=A.end;continue}!o&&t.options.strict&&Ce($)&&r($,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line")}if(x===0)A.comma&&r(A.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`);else if(A.comma||r(A.start,"MISSING_CHAR",`Missing , between ${a} items`),A.comment){let I="";e:for(let k of b)switch(k.type){case"comma":case"space":break;case"comment":I=k.source.substring(1);break e;default:break e}if(I){let k=l.items[l.items.length-1];E(k)&&(k=k.value??k.key),k.comment?k.comment+=`
`+I:k.comment=I,A.comment=A.comment.substring(I.length+1)}}if(!o&&!d&&!A.found){let I=S?n(t,S,A,r):e(t,A.end,d,null,A,r);l.items.push(I),p=I.range[2],_n(S)&&r(I.range,"BLOCK_IN_FLOW",Rn)}else{t.atKey=!0;let I=A.end,k=$?n(t,$,A,r):e(t,I,b,null,A,r);_n($)&&r(k.range,"BLOCK_IN_FLOW",Rn),t.atKey=!1;let w=he(d??[],{flow:a,indicator:"map-value-ind",next:S,offset:k.range[2],onError:r,parentIndent:i.indent,startOnNewline:!1});if(w.found){if(!o&&!A.found&&t.options.strict){if(d)for(let L of d){if(L===w.found)break;if(L.type==="newline"){r(L,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line");break}}A.start<w.found.offset-1024&&r(w.found,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit flow sequence key")}}else S&&("source"in S&&S.source?.[0]===":"?r(S,"MISSING_CHAR",`Missing space after : in ${a}`):r(w.start,"MISSING_CHAR",`Missing , or : between ${a} items`));let P=S?n(t,S,w,r):w.found?e(t,w.end,d,null,w,r):null;P?_n(S)&&r(P.range,"BLOCK_IN_FLOW",Rn):w.comment&&(k.comment?k.comment+=`
`+w.comment:k.comment=w.comment);let O=new R(k,P);if(t.options.keepSourceTokens&&(O.srcToken=y),o){let L=l;Zt(t,L.items,k)&&r(I,"DUPLICATE_KEY","Map keys must be unique"),L.items.push(O)}else{let L=new _(t.schema);L.flow=!0,L.items.push(O);let G=(P??k).range;L.range=[k.range[0],G[1],G[2]],l.items.push(L)}p=P?P.range[2]:w.end}}let m=o?"}":"]",[u,...g]=i.end,h=p;if(u?.source===m)h=u.offset+u.source.length;else{let x=a[0].toUpperCase()+a.substring(1),y=f?`${x} must end with a ${m}`:`${x} in block collection must be sufficiently indented and end with a ${m}`;r(p,f?"MISSING_CHAR":"BAD_INDENT",y),u&&u.source.length!==1&&g.unshift(u)}if(g.length>0){let x=ue(g,h,t.options.strict,r);x.comment&&(l.comment?l.comment+=`
`+x.comment:l.comment=x.comment),l.range=[i.offset,h,x.offset]}else l.range=[i.offset,h,h];return l}function zn(n,e,t,i,r,s){let o=t.type==="block-map"?qi(n,e,t,i,s):t.type==="block-seq"?Li(n,e,t,i,s):Ni(n,e,t,i,s),a=o.constructor;return r==="!"||r===a.tagName?(o.tag=a.tagName,o):(r&&(o.tag=r),o)}function Ri(n,e,t,i,r){let s=i.tag,o=s?e.directives.tagName(s.source,m=>r(s,"TAG_RESOLVE_FAILED",m)):null;if(t.type==="block-seq"){let{anchor:m,newlineAfterProp:u}=i,g=m&&s?m.offset>s.offset?m:s:m??s;g&&(!u||u.offset<g.offset)&&r(g,"MISSING_CHAR","Missing newline after block sequence props")}let a=t.type==="block-map"?"map":t.type==="block-seq"?"seq":t.start.source==="{"?"map":"seq";if(!s||!o||o==="!"||o===_.tagName&&a==="map"||o===U.tagName&&a==="seq")return zn(n,e,t,r,o);let c=e.schema.tags.find(m=>m.tag===o&&m.collection===a);if(!c){let m=e.schema.knownTags[o];if(m?.collection===a)e.schema.tags.push(Object.assign({},m,{default:!1})),c=m;else return m?r(s,"BAD_COLLECTION_TYPE",`${m.tag} used for ${a} collection, but expects ${m.collection??"scalar"}`,!0):r(s,"TAG_RESOLVE_FAILED",`Unresolved tag: ${o}`,!0),zn(n,e,t,r,o)}let l=zn(n,e,t,r,o,c),f=c.resolve?.(l,m=>r(s,"TAG_RESOLVE_FAILED",m),e.options)??l,p=C(f)?f:new v(f);return p.range=l.range,p.tag=o,c?.format&&(p.format=c.format),p}function Dn(n,e,t){let i=e.offset,r=Fr(e,n.options.strict,t);if(!r)return{value:"",type:null,comment:"",range:[i,i,i]};let s=r.mode===">"?v.BLOCK_FOLDED:v.BLOCK_LITERAL,o=e.source?Jr(e.source):[],a=o.length;for(let h=o.length-1;h>=0;--h){let x=o[h][1];if(x===""||x==="\r")a=h;else break}if(a===0){let h=r.chomp==="+"&&o.length>0?`
`.repeat(Math.max(1,o.length-1)):"",x=i+r.length;return e.source&&(x+=e.source.length),{value:h,type:s,comment:r.comment,range:[i,x,x]}}let c=e.indent+r.indent,l=e.offset+r.length,f=0;for(let h=0;h<a;++h){let[x,y]=o[h];if(y===""||y==="\r")r.indent===0&&x.length>c&&(c=x.length);else{x.length<c&&t(l+x.length,"MISSING_CHAR","Block scalars with more-indented leading empty lines must use an explicit indentation indicator"),r.indent===0&&(c=x.length),f=h,c===0&&!n.atRoot&&t(l,"BAD_INDENT","Block scalar values in collections must be indented");break}l+=x.length+y.length+1}for(let h=o.length-1;h>=a;--h)o[h][0].length>c&&(a=h+1);let p="",m="",u=!1;for(let h=0;h<f;++h)p+=o[h][0].slice(c)+`
`;for(let h=f;h<a;++h){let[x,y]=o[h];l+=x.length+y.length+1;let b=y[y.length-1]==="\r";if(b&&(y=y.slice(0,-1)),y&&x.length<c){let d=`Block scalar lines must not be less indented than their ${r.indent?"explicit indentation indicator":"first line"}`;t(l-y.length-(b?2:1),"BAD_INDENT",d),x=""}s===v.BLOCK_LITERAL?(p+=m+x.slice(c)+y,m=`
`):x.length>c||y[0]==="	"?(m===" "?m=`
`:!u&&m===`
`&&(m=`

`),p+=m+x.slice(c)+y,m=`
`,u=!0):y===""?m===`
`?p+=`
`:m=`
`:(p+=m+y,m=" ",u=!1)}switch(r.chomp){case"-":break;case"+":for(let h=a;h<o.length;++h)p+=`
`+o[h][0].slice(c);p[p.length-1]!==`
`&&(p+=`
`);break;default:p+=`
`}let g=i+r.length+e.source.length;return{value:p,type:s,comment:r.comment,range:[i,g,g]}}function Fr({offset:n,props:e},t,i){if(e[0].type!=="block-scalar-header")return i(e[0],"IMPOSSIBLE","Block scalar header not found"),null;let{source:r}=e[0],s=r[0],o=0,a="",c=-1;for(let m=1;m<r.length;++m){let u=r[m];if(!a&&(u==="-"||u==="+"))a=u;else{let g=Number(u);!o&&g?o=g:c===-1&&(c=n+m)}}c!==-1&&i(c,"UNEXPECTED_TOKEN",`Block scalar header includes extra characters: ${r}`);let l=!1,f="",p=r.length;for(let m=1;m<e.length;++m){let u=e[m];switch(u.type){case"space":l=!0;case"newline":p+=u.source.length;break;case"comment":t&&!l&&i(u,"MISSING_CHAR","Comments must be separated from other tokens by white space characters"),p+=u.source.length,f=u.source.substring(1);break;case"error":i(u,"UNEXPECTED_TOKEN",u.message),p+=u.source.length;break;default:{let g=`Unexpected token in block scalar header: ${u.type}`;i(u,"UNEXPECTED_TOKEN",g);let h=u.source;h&&typeof h=="string"&&(p+=h.length)}}}return{mode:s,indent:o,chomp:a,comment:f,length:p}}function Jr(n){let e=n.split(/\n( *)/),t=e[0],i=t.match(/^( *)/),s=[i?.[1]?[i[1],t.slice(i[1].length)]:["",t]];for(let o=1;o<e.length;o+=2)s.push([e[o],e[o+1]]);return s}function Bn(n,e,t){let{offset:i,type:r,source:s,end:o}=n,a,c,l=(m,u,g)=>t(i+m,u,g);switch(r){case"scalar":a=v.PLAIN,c=Hr(s,l);break;case"single-quoted-scalar":a=v.QUOTE_SINGLE,c=Wr(s,l);break;case"double-quoted-scalar":a=v.QUOTE_DOUBLE,c=Gr(s,l);break;default:return t(n,"UNEXPECTED_TOKEN",`Expected a flow scalar value, but found: ${r}`),{value:"",type:null,comment:"",range:[i,i+s.length,i+s.length]}}let f=i+s.length,p=ue(o,f,e,t);return{value:c,type:a,comment:p.comment,range:[i,f,p.offset]}}function Hr(n,e){let t="";switch(n[0]){case"	":t="a tab character";break;case",":t="flow indicator character ,";break;case"%":t="directive indicator character %";break;case"|":case">":{t=`block scalar indicator ${n[0]}`;break}case"@":case"`":{t=`reserved character ${n[0]}`;break}}return t&&e(0,"BAD_SCALAR_START",`Plain value cannot start with ${t}`),_i(n)}function Wr(n,e){return(n[n.length-1]!=="'"||n.length===1)&&e(n.length,"MISSING_CHAR","Missing closing 'quote"),_i(n.slice(1,-1)).replace(/''/g,"'")}function _i(n){let e,t;try{e=new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`,"sy"),t=new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`,"sy")}catch{e=/(.*?)[ \t]*\r?\n/sy,t=/[ \t]*(.*?)[ \t]*\r?\n/sy}let i=e.exec(n);if(!i)return n;let r=i[1],s=" ",o=e.lastIndex;for(t.lastIndex=o;i=t.exec(n);)i[1]===""?s===`
`?r+=s:s=`
`:(r+=s+i[1],s=" "),o=t.lastIndex;let a=/[ \t]*(.*)/sy;return a.lastIndex=o,i=a.exec(n),r+s+(i?.[1]??"")}function Gr(n,e){let t="";for(let i=1;i<n.length-1;++i){let r=n[i];if(!(r==="\r"&&n[i+1]===`
`))if(r===`
`){let{fold:s,offset:o}=Yr(n,i);t+=s,i=o}else if(r==="\\"){let s=n[++i],o=Qr[s];if(o)t+=o;else if(s===`
`)for(s=n[i+1];s===" "||s==="	";)s=n[++i+1];else if(s==="\r"&&n[i+1]===`
`)for(s=n[++i+1];s===" "||s==="	";)s=n[++i+1];else if(s==="x"||s==="u"||s==="U"){let a={x:2,u:4,U:8}[s];t+=Xr(n,i+1,a,e),i+=a}else{let a=n.substr(i-1,2);e(i-1,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),t+=a}}else if(r===" "||r==="	"){let s=i,o=n[i+1];for(;o===" "||o==="	";)o=n[++i+1];o!==`
`&&!(o==="\r"&&n[i+2]===`
`)&&(t+=i>s?n.slice(s,i+1):r)}else t+=r}return(n[n.length-1]!=='"'||n.length===1)&&e(n.length,"MISSING_CHAR",'Missing closing "quote'),t}function Yr(n,e){let t="",i=n[e+1];for(;(i===" "||i==="	"||i===`
`||i==="\r")&&!(i==="\r"&&n[e+2]!==`
`);)i===`
`&&(t+=`
`),e+=1,i=n[e+1];return t||(t=" "),{fold:t,offset:e}}var Qr={0:"\0",a:"\x07",b:"\b",e:"\x1B",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",N:"\x85",_:"\xA0",L:"\u2028",P:"\u2029"," ":" ",'"':'"',"/":"/","\\":"\\","	":"	"};function Xr(n,e,t,i){let r=n.substr(e,t),o=r.length===t&&/^[0-9a-fA-F]+$/.test(r)?parseInt(r,16):NaN;if(isNaN(o)){let a=n.substr(e-2,t+2);return i(e-2,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),a}return String.fromCodePoint(o)}function Mn(n,e,t,i){let{value:r,type:s,comment:o,range:a}=e.type==="block-scalar"?Dn(n,e,i):Bn(e,n.options.strict,i),c=t?n.directives.tagName(t.source,p=>i(t,"TAG_RESOLVE_FAILED",p)):null,l;n.options.stringKeys&&n.atKey?l=n.schema[Q]:c?l=Zr(n.schema,r,c,t,i):e.type==="scalar"?l=es(n,r,e,i):l=n.schema[Q];let f;try{let p=l.resolve(r,m=>i(t??e,"TAG_RESOLVE_FAILED",m),n.options);f=j(p)?p:new v(p)}catch(p){let m=p instanceof Error?p.message:String(p);i(t??e,"TAG_RESOLVE_FAILED",m),f=new v(r)}return f.range=a,f.source=r,s&&(f.type=s),c&&(f.tag=c),l.format&&(f.format=l.format),o&&(f.comment=o),f}function Zr(n,e,t,i,r){if(t==="!")return n[Q];let s=[];for(let a of n.tags)if(!a.collection&&a.tag===t)if(a.default&&a.test)s.push(a);else return a;for(let a of s)if(a.test?.test(e))return a;let o=n.knownTags[t];return o&&!o.collection?(n.tags.push(Object.assign({},o,{default:!1,test:void 0})),o):(r(i,"TAG_RESOLVE_FAILED",`Unresolved tag: ${t}`,t!=="tag:yaml.org,2002:str"),n[Q])}function es({atKey:n,directives:e,schema:t},i,r,s){let o=t.tags.find(a=>(a.default===!0||n&&a.default==="key")&&a.test?.test(i))||t[Q];if(t.compat){let a=t.compat.find(c=>c.default&&c.test?.test(i))??t[Q];if(o.tag!==a.tag){let c=e.tagString(o.tag),l=e.tagString(a.tag),f=`Value may be parsed as either ${c} or ${l}`;s(r,"TAG_RESOLVE_FAILED",f,!0)}}return o}function zi(n,e,t){if(e){t??(t=e.length);for(let i=t-1;i>=0;--i){let r=e[i];switch(r.type){case"space":case"comment":case"newline":n-=r.source.length;continue}for(r=e[++i];r?.type==="space";)n+=r.source.length,r=e[++i];break}}return n}var ts={composeNode:Un,composeEmptyNode:en};function Un(n,e,t,i){let r=n.atKey,{spaceBefore:s,comment:o,anchor:a,tag:c}=t,l,f=!0;switch(e.type){case"alias":l=ns(n,e,i),(a||c)&&i(e,"ALIAS_PROPS","An alias node must not specify any properties");break;case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"block-scalar":l=Mn(n,e,c,i),a&&(l.anchor=a.source.substring(1));break;case"block-map":case"block-seq":case"flow-collection":l=Ri(ts,n,e,t,i),a&&(l.anchor=a.source.substring(1));break;default:{let p=e.type==="error"?e.message:`Unsupported token (type: ${e.type})`;i(e,"UNEXPECTED_TOKEN",p),l=en(n,e.offset,void 0,null,t,i),f=!1}}return a&&l.anchor===""&&i(a,"BAD_ALIAS","Anchor cannot be an empty string"),r&&n.options.stringKeys&&(!j(l)||typeof l.value!="string"||l.tag&&l.tag!=="tag:yaml.org,2002:str")&&i(c??e,"NON_STRING_KEY","With stringKeys, all keys must be strings"),s&&(l.spaceBefore=!0),o&&(e.type==="scalar"&&e.source===""?l.comment=o:l.commentBefore=o),n.options.keepSourceTokens&&f&&(l.srcToken=e),l}function en(n,e,t,i,{spaceBefore:r,comment:s,anchor:o,tag:a,end:c},l){let f={type:"scalar",offset:zi(e,t,i),indent:-1,source:""},p=Mn(n,f,a,l);return o&&(p.anchor=o.source.substring(1),p.anchor===""&&l(o,"BAD_ALIAS","Anchor cannot be an empty string")),r&&(p.spaceBefore=!0),s&&(p.comment=s,p.range[2]=c),p}function ns({options:n},{offset:e,source:t,end:i},r){let s=new xe(t.substring(1));s.source===""&&r(e,"BAD_ALIAS","Alias cannot be an empty string"),s.source.endsWith(":")&&r(e+t.length-1,"BAD_ALIAS","Alias ending in : is ambiguous",!0);let o=e+t.length,a=ue(i,o,n.strict,r);return s.range=[e,o,a.offset],a.comment&&(s.comment=a.comment),s}function Di(n,e,{offset:t,start:i,value:r,end:s},o){let a=Object.assign({_directives:e},n),c=new $e(void 0,a),l={atKey:!1,atRoot:!0,directives:c.directives,options:c.options,schema:c.schema},f=he(i,{indicator:"doc-start",next:r??s?.[0],offset:t,onError:o,parentIndent:0,startOnNewline:!0});f.found&&(c.directives.docStart=!0,r&&(r.type==="block-map"||r.type==="block-seq")&&!f.hasNewline&&o(f.end,"MISSING_CHAR","Block collection cannot start on same line with directives-end marker")),c.contents=r?Un(l,r,f,o):en(l,f.end,i,null,f,o);let p=c.contents.range[2],m=ue(s,p,!1,o);return m.comment&&(c.comment=m.comment),c.range=[t,p,m.offset],c}function ut(n){if(typeof n=="number")return[n,n+1];if(Array.isArray(n))return n.length===2?n:[n[0],n[1]];let{offset:e,source:t}=n;return[e,e+(typeof t=="string"?t.length:1)]}function Bi(n){let e="",t=!1,i=!1;for(let r=0;r<n.length;++r){let s=n[r];switch(s[0]){case"#":e+=(e===""?"":i?`

`:`
`)+(s.substring(1)||" "),t=!0,i=!1;break;case"%":n[r+1]?.[0]!=="#"&&(r+=1),t=!1;break;default:t||(i=!0),t=!1}}return{comment:e,afterEmptyLine:i}}var gt=class{constructor(e={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(t,i,r,s)=>{let o=ut(t);s?this.warnings.push(new mt(o,i,r)):this.errors.push(new ae(o,i,r))},this.directives=new de({version:e.version||"1.2"}),this.options=e}decorate(e,t){let{comment:i,afterEmptyLine:r}=Bi(this.prelude);if(i){let s=e.contents;if(t)e.comment=e.comment?`${e.comment}
${i}`:i;else if(r||e.directives.docStart||!s)e.commentBefore=i;else if(q(s)&&!s.flow&&s.items.length>0){let o=s.items[0];E(o)&&(o=o.key);let a=o.commentBefore;o.commentBefore=a?`${i}
${a}`:i}else{let o=s.commentBefore;s.commentBefore=o?`${i}
${o}`:i}}t?(Array.prototype.push.apply(e.errors,this.errors),Array.prototype.push.apply(e.warnings,this.warnings)):(e.errors=this.errors,e.warnings=this.warnings),this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:Bi(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(e,t=!1,i=-1){for(let r of e)yield*this.next(r);yield*this.end(t,i)}*next(e){switch(e.type){case"directive":this.directives.add(e.source,(t,i,r)=>{let s=ut(e);s[0]+=t,this.onError(s,"BAD_DIRECTIVE",i,r)}),this.prelude.push(e.source),this.atDirectives=!0;break;case"document":{let t=Di(this.options,this.directives,e,this.onError);this.atDirectives&&!t.directives.docStart&&this.onError(e,"MISSING_CHAR","Missing directives-end/doc-start indicator line"),this.decorate(t,!1),this.doc&&(yield this.doc),this.doc=t,this.atDirectives=!1;break}case"byte-order-mark":case"space":break;case"comment":case"newline":this.prelude.push(e.source);break;case"error":{let t=e.source?`${e.message}: ${JSON.stringify(e.source)}`:e.message,i=new ae(ut(e),"UNEXPECTED_TOKEN",t);this.atDirectives||!this.doc?this.errors.push(i):this.doc.errors.push(i);break}case"doc-end":{if(!this.doc){let i="Unexpected doc-end without preceding document";this.errors.push(new ae(ut(e),"UNEXPECTED_TOKEN",i));break}this.doc.directives.docEnd=!0;let t=ue(e.end,e.offset+e.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),t.comment){let i=this.doc.comment;this.doc.comment=i?`${i}
${t.comment}`:t.comment}this.doc.range[2]=t.offset;break}default:this.errors.push(new ae(ut(e),"UNEXPECTED_TOKEN",`Unsupported token ${e.type}`))}}*end(e=!1,t=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(e){let i=Object.assign({_directives:this.directives},this.options),r=new $e(void 0,i);this.atDirectives&&this.onError(t,"MISSING_CHAR","Missing directives-end indicator line"),r.range=[0,t,t],this.decorate(r,!1),yield r}}};var Kn=Symbol("break visit"),is=Symbol("skip children"),Mi=Symbol("remove item");function Re(n,e){"type"in n&&n.type==="document"&&(n={start:n.start,value:n.value}),Ui(Object.freeze([]),n,e)}Re.BREAK=Kn;Re.SKIP=is;Re.REMOVE=Mi;Re.itemAtPath=(n,e)=>{let t=n;for(let[i,r]of e){let s=t?.[i];if(s&&"items"in s)t=s.items[r];else return}return t};Re.parentCollection=(n,e)=>{let t=Re.itemAtPath(n,e.slice(0,-1)),i=e[e.length-1][0],r=t?.[i];if(r&&"items"in r)return r;throw new Error("Parent collection not found")};function Ui(n,e,t){let i=t(e,n);if(typeof i=="symbol")return i;for(let r of["key","value"]){let s=e[r];if(s&&"items"in s){for(let o=0;o<s.items.length;++o){let a=Ui(Object.freeze(n.concat([[r,o]])),s.items[o],t);if(typeof a=="number")o=a-1;else{if(a===Kn)return Kn;a===Mi&&(s.items.splice(o,1),o-=1)}}typeof i=="function"&&r==="key"&&(i=i(e,n))}}return typeof i=="function"?i(e,n):i}var Vn="\uFEFF",Fn="",Jn="",tn="";function Ki(n){switch(n){case Vn:return"byte-order-mark";case Fn:return"doc-mode";case Jn:return"flow-error-end";case tn:return"scalar";case"---":return"doc-start";case"...":return"doc-end";case"":case`
`:case`\r
`:return"newline";case"-":return"seq-item-ind";case"?":return"explicit-key-ind";case":":return"map-value-ind";case"{":return"flow-map-start";case"}":return"flow-map-end";case"[":return"flow-seq-start";case"]":return"flow-seq-end";case",":return"comma"}switch(n[0]){case" ":case"	":return"space";case"#":return"comment";case"%":return"directive-line";case"*":return"alias";case"&":return"anchor";case"!":return"tag";case"'":return"single-quoted-scalar";case'"':return"double-quoted-scalar";case"|":case">":return"block-scalar-header"}return null}function ce(n){switch(n){case void 0:case" ":case`
`:case"\r":case"	":return!0;default:return!1}}var Vi=new Set("0123456789ABCDEFabcdef"),ss=new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()"),nn=new Set(",[]{}"),os=new Set(` ,[]{}
\r	`),Hn=n=>!n||os.has(n),yt=class{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer="",this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(e,t=!1){if(e){if(typeof e!="string")throw TypeError("source is not a string");this.buffer=this.buffer?this.buffer+e:e,this.lineEndPos=null}this.atEnd=!t;let i=this.next??"stream";for(;i&&(t||this.hasChars(1));)i=yield*this.parseNext(i)}atLineEnd(){let e=this.pos,t=this.buffer[e];for(;t===" "||t==="	";)t=this.buffer[++e];return!t||t==="#"||t===`
`?!0:t==="\r"?this.buffer[e+1]===`
`:!1}charAt(e){return this.buffer[this.pos+e]}continueScalar(e){let t=this.buffer[e];if(this.indentNext>0){let i=0;for(;t===" ";)t=this.buffer[++i+e];if(t==="\r"){let r=this.buffer[i+e+1];if(r===`
`||!r&&!this.atEnd)return e+i+1}return t===`
`||i>=this.indentNext||!t&&!this.atEnd?e+i:-1}if(t==="-"||t==="."){let i=this.buffer.substr(e,3);if((i==="---"||i==="...")&&ce(this.buffer[e+3]))return-1}return e}getLine(){let e=this.lineEndPos;return(typeof e!="number"||e!==-1&&e<this.pos)&&(e=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=e),e===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[e-1]==="\r"&&(e-=1),this.buffer.substring(this.pos,e))}hasChars(e){return this.pos+e<=this.buffer.length}setNext(e){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=e,null}peek(e){return this.buffer.substr(this.pos,e)}*parseNext(e){switch(e){case"stream":return yield*this.parseStream();case"line-start":return yield*this.parseLineStart();case"block-start":return yield*this.parseBlockStart();case"doc":return yield*this.parseDocument();case"flow":return yield*this.parseFlowCollection();case"quoted-scalar":return yield*this.parseQuotedScalar();case"block-scalar":return yield*this.parseBlockScalar();case"plain-scalar":return yield*this.parsePlainScalar()}}*parseStream(){let e=this.getLine();if(e===null)return this.setNext("stream");if(e[0]===Vn&&(yield*this.pushCount(1),e=e.substring(1)),e[0]==="%"){let t=e.length,i=e.indexOf("#");for(;i!==-1;){let s=e[i-1];if(s===" "||s==="	"){t=i-1;break}else i=e.indexOf("#",i+1)}for(;;){let s=e[t-1];if(s===" "||s==="	")t-=1;else break}let r=(yield*this.pushCount(t))+(yield*this.pushSpaces(!0));return yield*this.pushCount(e.length-r),this.pushNewline(),"stream"}if(this.atLineEnd()){let t=yield*this.pushSpaces(!0);return yield*this.pushCount(e.length-t),yield*this.pushNewline(),"stream"}return yield Fn,yield*this.parseLineStart()}*parseLineStart(){let e=this.charAt(0);if(!e&&!this.atEnd)return this.setNext("line-start");if(e==="-"||e==="."){if(!this.atEnd&&!this.hasChars(4))return this.setNext("line-start");let t=this.peek(3);if((t==="---"||t==="...")&&ce(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,t==="---"?"doc":"stream"}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!ce(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){let[e,t]=this.peek(2);if(!t&&!this.atEnd)return this.setNext("block-start");if((e==="-"||e==="?"||e===":")&&ce(t)){let i=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=i,yield*this.parseBlockStart()}return"doc"}*parseDocument(){yield*this.pushSpaces(!0);let e=this.getLine();if(e===null)return this.setNext("doc");let t=yield*this.pushIndicators();switch(e[t]){case"#":yield*this.pushCount(e.length-t);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,"flow";case"}":case"]":return yield*this.pushCount(1),"doc";case"*":return yield*this.pushUntil(Hn),"doc";case'"':case"'":return yield*this.parseQuotedScalar();case"|":case">":return t+=yield*this.parseBlockScalarHeader(),t+=yield*this.pushSpaces(!0),yield*this.pushCount(e.length-t),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let e,t,i=-1;do e=yield*this.pushNewline(),e>0?(t=yield*this.pushSpaces(!1),this.indentValue=i=t):t=0,t+=yield*this.pushSpaces(!0);while(e+t>0);let r=this.getLine();if(r===null)return this.setNext("flow");if((i!==-1&&i<this.indentNext&&r[0]!=="#"||i===0&&(r.startsWith("---")||r.startsWith("..."))&&ce(r[3]))&&!(i===this.indentNext-1&&this.flowLevel===1&&(r[0]==="]"||r[0]==="}")))return this.flowLevel=0,yield Jn,yield*this.parseLineStart();let s=0;for(;r[s]===",";)s+=yield*this.pushCount(1),s+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(s+=yield*this.pushIndicators(),r[s]){case void 0:return"flow";case"#":return yield*this.pushCount(r.length-s),"flow";case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,"flow";case"}":case"]":return yield*this.pushCount(1),this.flowKey=!0,this.flowLevel-=1,this.flowLevel?"flow":"doc";case"*":return yield*this.pushUntil(Hn),"flow";case'"':case"'":return this.flowKey=!0,yield*this.parseQuotedScalar();case":":{let o=this.charAt(1);if(this.flowKey||ce(o)||o===",")return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),"flow"}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){let e=this.charAt(0),t=this.buffer.indexOf(e,this.pos+1);if(e==="'")for(;t!==-1&&this.buffer[t+1]==="'";)t=this.buffer.indexOf("'",t+2);else for(;t!==-1;){let s=0;for(;this.buffer[t-1-s]==="\\";)s+=1;if(s%2===0)break;t=this.buffer.indexOf('"',t+1)}let i=this.buffer.substring(0,t),r=i.indexOf(`
`,this.pos);if(r!==-1){for(;r!==-1;){let s=this.continueScalar(r+1);if(s===-1)break;r=i.indexOf(`
`,s)}r!==-1&&(t=r-(i[r-1]==="\r"?2:1))}if(t===-1){if(!this.atEnd)return this.setNext("quoted-scalar");t=this.buffer.length}return yield*this.pushToIndex(t+1,!1),this.flowLevel?"flow":"doc"}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let e=this.pos;for(;;){let t=this.buffer[++e];if(t==="+")this.blockScalarKeep=!0;else if(t>"0"&&t<="9")this.blockScalarIndent=Number(t)-1;else if(t!=="-")break}return yield*this.pushUntil(t=>ce(t)||t==="#")}*parseBlockScalar(){let e=this.pos-1,t=0,i;e:for(let s=this.pos;i=this.buffer[s];++s)switch(i){case" ":t+=1;break;case`
`:e=s,t=0;break;case"\r":{let o=this.buffer[s+1];if(!o&&!this.atEnd)return this.setNext("block-scalar");if(o===`
`)break}default:break e}if(!i&&!this.atEnd)return this.setNext("block-scalar");if(t>=this.indentNext){this.blockScalarIndent===-1?this.indentNext=t:this.indentNext=this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{let s=this.continueScalar(e+1);if(s===-1)break;e=this.buffer.indexOf(`
`,s)}while(e!==-1);if(e===-1){if(!this.atEnd)return this.setNext("block-scalar");e=this.buffer.length}}let r=e+1;for(i=this.buffer[r];i===" ";)i=this.buffer[++r];if(i==="	"){for(;i==="	"||i===" "||i==="\r"||i===`
`;)i=this.buffer[++r];e=r-1}else if(!this.blockScalarKeep)do{let s=e-1,o=this.buffer[s];o==="\r"&&(o=this.buffer[--s]);let a=s;for(;o===" ";)o=this.buffer[--s];if(o===`
`&&s>=this.pos&&s+1+t>a)e=s;else break}while(!0);return yield tn,yield*this.pushToIndex(e+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){let e=this.flowLevel>0,t=this.pos-1,i=this.pos-1,r;for(;r=this.buffer[++i];)if(r===":"){let s=this.buffer[i+1];if(ce(s)||e&&nn.has(s))break;t=i}else if(ce(r)){let s=this.buffer[i+1];if(r==="\r"&&(s===`
`?(i+=1,r=`
`,s=this.buffer[i+1]):t=i),s==="#"||e&&nn.has(s))break;if(r===`
`){let o=this.continueScalar(i+1);if(o===-1)break;i=Math.max(i,o-2)}}else{if(e&&nn.has(r))break;t=i}return!r&&!this.atEnd?this.setNext("plain-scalar"):(yield tn,yield*this.pushToIndex(t+1,!0),e?"flow":"doc")}*pushCount(e){return e>0?(yield this.buffer.substr(this.pos,e),this.pos+=e,e):0}*pushToIndex(e,t){let i=this.buffer.slice(this.pos,e);return i?(yield i,this.pos+=i.length,i.length):(t&&(yield""),0)}*pushIndicators(){switch(this.charAt(0)){case"!":return(yield*this.pushTag())+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"&":return(yield*this.pushUntil(Hn))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"-":case"?":case":":{let e=this.flowLevel>0,t=this.charAt(1);if(ce(t)||e&&nn.has(t))return e?this.flowKey&&(this.flowKey=!1):this.indentNext=this.indentValue+1,(yield*this.pushCount(1))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators())}}return 0}*pushTag(){if(this.charAt(1)==="<"){let e=this.pos+2,t=this.buffer[e];for(;!ce(t)&&t!==">";)t=this.buffer[++e];return yield*this.pushToIndex(t===">"?e+1:e,!1)}else{let e=this.pos+1,t=this.buffer[e];for(;t;)if(ss.has(t))t=this.buffer[++e];else if(t==="%"&&Vi.has(this.buffer[e+1])&&Vi.has(this.buffer[e+2]))t=this.buffer[e+=3];else break;return yield*this.pushToIndex(e,!1)}}*pushNewline(){let e=this.buffer[this.pos];return e===`
`?yield*this.pushCount(1):e==="\r"&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(e){let t=this.pos-1,i;do i=this.buffer[++t];while(i===" "||e&&i==="	");let r=t-this.pos;return r>0&&(yield this.buffer.substr(this.pos,r),this.pos=t),r}*pushUntil(e){let t=this.pos,i=this.buffer[t];for(;!e(i);)i=this.buffer[++t];return yield*this.pushToIndex(t,!1)}};var bt=class{constructor(){this.lineStarts=[],this.addNewLine=e=>this.lineStarts.push(e),this.linePos=e=>{let t=0,i=this.lineStarts.length;for(;t<i;){let s=t+i>>1;this.lineStarts[s]<e?t=s+1:i=s}if(this.lineStarts[t]===e)return{line:t+1,col:1};if(t===0)return{line:0,col:e};let r=this.lineStarts[t-1];return{line:t,col:e-r+1}}}};function Ie(n,e){for(let t=0;t<n.length;++t)if(n[t].type===e)return!0;return!1}function Fi(n){for(let e=0;e<n.length;++e)switch(n[e].type){case"space":case"comment":case"newline":break;default:return e}return-1}function Hi(n){switch(n?.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"flow-collection":return!0;default:return!1}}function rn(n){switch(n.type){case"document":return n.start;case"block-map":{let e=n.items[n.items.length-1];return e.sep??e.start}case"block-seq":return n.items[n.items.length-1].start;default:return[]}}function Qe(n){if(n.length===0)return[];let e=n.length;e:for(;--e>=0;)switch(n[e].type){case"doc-start":case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":case"newline":break e}for(;n[++e]?.type==="space";);return n.splice(e,n.length)}function Ji(n){if(n.start.type==="flow-seq-start")for(let e of n.items)e.sep&&!e.value&&!Ie(e.start,"explicit-key-ind")&&!Ie(e.sep,"map-value-ind")&&(e.key&&(e.value=e.key),delete e.key,Hi(e.value)?e.value.end?Array.prototype.push.apply(e.value.end,e.sep):e.value.end=e.sep:Array.prototype.push.apply(e.start,e.sep),delete e.sep)}var xt=class{constructor(e){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source="",this.type="",this.lexer=new yt,this.onNewLine=e}*parse(e,t=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(let i of this.lexer.lex(e,t))yield*this.next(i);t||(yield*this.end())}*next(e){if(this.source=e,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=e.length;return}let t=Ki(e);if(t)if(t==="scalar")this.atNewLine=!1,this.atScalar=!0,this.type="scalar";else{switch(this.type=t,yield*this.step(),t){case"newline":this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+e.length);break;case"space":this.atNewLine&&e[0]===" "&&(this.indent+=e.length);break;case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":this.atNewLine&&(this.indent+=e.length);break;case"doc-mode":case"flow-error-end":return;default:this.atNewLine=!1}this.offset+=e.length}else{let i=`Not a YAML token: ${e}`;yield*this.pop({type:"error",offset:this.offset,message:i,source:e}),this.offset+=e.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){let e=this.peek(1);if(this.type==="doc-end"&&e?.type!=="doc-end"){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:"doc-end",offset:this.offset,source:this.source});return}if(!e)return yield*this.stream();switch(e.type){case"document":return yield*this.document(e);case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return yield*this.scalar(e);case"block-scalar":return yield*this.blockScalar(e);case"block-map":return yield*this.blockMap(e);case"block-seq":return yield*this.blockSequence(e);case"flow-collection":return yield*this.flowCollection(e);case"doc-end":return yield*this.documentEnd(e)}yield*this.pop()}peek(e){return this.stack[this.stack.length-e]}*pop(e){let t=e??this.stack.pop();if(!t)yield{type:"error",offset:this.offset,source:"",message:"Tried to pop an empty stack"};else if(this.stack.length===0)yield t;else{let i=this.peek(1);switch(t.type==="block-scalar"?t.indent="indent"in i?i.indent:0:t.type==="flow-collection"&&i.type==="document"&&(t.indent=0),t.type==="flow-collection"&&Ji(t),i.type){case"document":i.value=t;break;case"block-scalar":i.props.push(t);break;case"block-map":{let r=i.items[i.items.length-1];if(r.value){i.items.push({start:[],key:t,sep:[]}),this.onKeyLine=!0;return}else if(r.sep)r.value=t;else{Object.assign(r,{key:t,sep:[]}),this.onKeyLine=!r.explicitKey;return}break}case"block-seq":{let r=i.items[i.items.length-1];r.value?i.items.push({start:[],value:t}):r.value=t;break}case"flow-collection":{let r=i.items[i.items.length-1];!r||r.value?i.items.push({start:[],key:t,sep:[]}):r.sep?r.value=t:Object.assign(r,{key:t,sep:[]});return}default:yield*this.pop(),yield*this.pop(t)}if((i.type==="document"||i.type==="block-map"||i.type==="block-seq")&&(t.type==="block-map"||t.type==="block-seq")){let r=t.items[t.items.length-1];r&&!r.sep&&!r.value&&r.start.length>0&&Fi(r.start)===-1&&(t.indent===0||r.start.every(s=>s.type!=="comment"||s.indent<t.indent))&&(i.type==="document"?i.end=r.start:i.items.push({start:r.start}),t.items.splice(-1,1))}}}*stream(){switch(this.type){case"directive-line":yield{type:"directive",offset:this.offset,source:this.source};return;case"byte-order-mark":case"space":case"comment":case"newline":yield this.sourceToken;return;case"doc-mode":case"doc-start":{let e={type:"document",offset:this.offset,start:[]};this.type==="doc-start"&&e.start.push(this.sourceToken),this.stack.push(e);return}}yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(e){if(e.value)return yield*this.lineEnd(e);switch(this.type){case"doc-start":{Fi(e.start)!==-1?(yield*this.pop(),yield*this.step()):e.start.push(this.sourceToken);return}case"anchor":case"tag":case"space":case"comment":case"newline":e.start.push(this.sourceToken);return}let t=this.startBlockValue(e);t?this.stack.push(t):yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(e){if(this.type==="map-value-ind"){let t=rn(this.peek(2)),i=Qe(t),r;e.end?(r=e.end,r.push(this.sourceToken),delete e.end):r=[this.sourceToken];let s={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:i,key:e,sep:r}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=s}else yield*this.lineEnd(e)}*blockScalar(e){switch(this.type){case"space":case"comment":case"newline":e.props.push(this.sourceToken);return;case"scalar":if(e.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(e){let t=e.items[e.items.length-1];switch(this.type){case"newline":if(this.onKeyLine=!1,t.value){let i="end"in t.value?t.value.end:void 0;(Array.isArray(i)?i[i.length-1]:void 0)?.type==="comment"?i?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else if(t.sep)t.sep.push(this.sourceToken);else{if(this.atIndentedComment(t.start,e.indent)){let r=e.items[e.items.length-2]?.value?.end;if(Array.isArray(r)){Array.prototype.push.apply(r,t.start),r.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return}if(this.indent>=e.indent){let i=!this.onKeyLine&&this.indent===e.indent,r=i&&(t.sep||t.explicitKey)&&this.type!=="seq-item-ind",s=[];if(r&&t.sep&&!t.value){let o=[];for(let a=0;a<t.sep.length;++a){let c=t.sep[a];switch(c.type){case"newline":o.push(a);break;case"space":break;case"comment":c.indent>e.indent&&(o.length=0);break;default:o.length=0}}o.length>=2&&(s=t.sep.splice(o[1]))}switch(this.type){case"anchor":case"tag":r||t.value?(s.push(this.sourceToken),e.items.push({start:s}),this.onKeyLine=!0):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"explicit-key-ind":!t.sep&&!t.explicitKey?(t.start.push(this.sourceToken),t.explicitKey=!0):r||t.value?(s.push(this.sourceToken),e.items.push({start:s,explicitKey:!0})):this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case"map-value-ind":if(t.explicitKey)if(t.sep)if(t.value)e.items.push({start:[],key:null,sep:[this.sourceToken]});else if(Ie(t.sep,"map-value-ind"))this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,key:null,sep:[this.sourceToken]}]});else if(Hi(t.key)&&!Ie(t.sep,"newline")){let o=Qe(t.start),a=t.key,c=t.sep;c.push(this.sourceToken),delete t.key,delete t.sep,this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:a,sep:c}]})}else s.length>0?t.sep=t.sep.concat(s,this.sourceToken):t.sep.push(this.sourceToken);else if(Ie(t.start,"newline"))Object.assign(t,{key:null,sep:[this.sourceToken]});else{let o=Qe(t.start);this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:null,sep:[this.sourceToken]}]})}else t.sep?t.value||r?e.items.push({start:s,key:null,sep:[this.sourceToken]}):Ie(t.sep,"map-value-ind")?this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{let o=this.flowScalar(this.type);r||t.value?(e.items.push({start:s,key:o,sep:[]}),this.onKeyLine=!0):t.sep?this.stack.push(o):(Object.assign(t,{key:o,sep:[]}),this.onKeyLine=!0);return}default:{let o=this.startBlockValue(e);if(o){if(o.type==="block-seq"){if(!t.explicitKey&&t.sep&&!Ie(t.sep,"newline")){yield*this.pop({type:"error",offset:this.offset,message:"Unexpected block-seq-ind on same line with key",source:this.source});return}}else i&&e.items.push({start:s});this.stack.push(o);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(e){let t=e.items[e.items.length-1];switch(this.type){case"newline":if(t.value){let i="end"in t.value?t.value.end:void 0;(Array.isArray(i)?i[i.length-1]:void 0)?.type==="comment"?i?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(t.start,e.indent)){let r=e.items[e.items.length-2]?.value?.end;if(Array.isArray(r)){Array.prototype.push.apply(r,t.start),r.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return;case"anchor":case"tag":if(t.value||this.indent<=e.indent)break;t.start.push(this.sourceToken);return;case"seq-item-ind":if(this.indent!==e.indent)break;t.value||Ie(t.start,"seq-item-ind")?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return}if(this.indent>e.indent){let i=this.startBlockValue(e);if(i){this.stack.push(i);return}}yield*this.pop(),yield*this.step()}*flowCollection(e){let t=e.items[e.items.length-1];if(this.type==="flow-error-end"){let i;do yield*this.pop(),i=this.peek(1);while(i?.type==="flow-collection")}else if(e.end.length===0){switch(this.type){case"comma":case"explicit-key-ind":!t||t.sep?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return;case"map-value-ind":!t||t.value?e.items.push({start:[],key:null,sep:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});return;case"space":case"comment":case"newline":case"anchor":case"tag":!t||t.value?e.items.push({start:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{let r=this.flowScalar(this.type);!t||t.value?e.items.push({start:[],key:r,sep:[]}):t.sep?this.stack.push(r):Object.assign(t,{key:r,sep:[]});return}case"flow-map-end":case"flow-seq-end":e.end.push(this.sourceToken);return}let i=this.startBlockValue(e);i?this.stack.push(i):(yield*this.pop(),yield*this.step())}else{let i=this.peek(2);if(i.type==="block-map"&&(this.type==="map-value-ind"&&i.indent===e.indent||this.type==="newline"&&!i.items[i.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type==="map-value-ind"&&i.type!=="flow-collection"){let r=rn(i),s=Qe(r);Ji(e);let o=e.end.splice(1,e.end.length);o.push(this.sourceToken);let a={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:s,key:e,sep:o}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=a}else yield*this.lineEnd(e)}}flowScalar(e){if(this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}return{type:e,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(e){switch(this.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return this.flowScalar(this.type);case"block-scalar-header":return{type:"block-scalar",offset:this.offset,indent:this.indent,props:[this.sourceToken],source:""};case"flow-map-start":case"flow-seq-start":return{type:"flow-collection",offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case"seq-item-ind":return{type:"block-seq",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case"explicit-key-ind":{this.onKeyLine=!0;let t=rn(e),i=Qe(t);return i.push(this.sourceToken),{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:i,explicitKey:!0}]}}case"map-value-ind":{this.onKeyLine=!0;let t=rn(e),i=Qe(t);return{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:i,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(e,t){return this.type!=="comment"||this.indent<=t?!1:e.every(i=>i.type==="newline"||i.type==="space")}*documentEnd(e){this.type!=="doc-mode"&&(e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop()))}*lineEnd(e){switch(this.type){case"comma":case"doc-start":case"doc-end":case"flow-seq-end":case"flow-map-end":case"map-value-ind":yield*this.pop(),yield*this.step();break;case"newline":this.onKeyLine=!1;case"space":case"comment":default:e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop())}}};function as(n){let e=n.prettyErrors!==!1;return{lineCounter:n.lineCounter||e&&new bt||null,prettyErrors:e}}function sn(n,e={}){let{lineCounter:t,prettyErrors:i}=as(e),r=new xt(t?.addNewLine),s=new gt(e),o=null;for(let a of s.compose(r.parse(n),!0,n.length))if(!o)o=a;else if(o.options.logLevel!=="silent"){o.errors.push(new ae(a.range.slice(0,2),"MULTIPLE_DOCS","Source contains multiple documents; please use YAML.parseAllDocuments()"));break}return i&&t&&(o.errors.forEach(Nn(n,t)),o.warnings.forEach(Nn(n,t))),o}function _e(n,e,t){let i;typeof e=="function"?i=e:t===void 0&&e&&typeof e=="object"&&(t=e);let r=sn(n,t);if(!r)return null;if(r.warnings.forEach(s=>Nt(r.options.logLevel,s)),r.errors.length>0){if(r.options.logLevel!=="silent")throw r.errors[0];r.errors=[]}return r.toJS(Object.assign({reviver:i},t))}function on(n,e,t){let i=null;if(typeof e=="function"||Array.isArray(e)?i=e:t===void 0&&e&&(t=e),typeof t=="string"&&(t=t.length),typeof t=="number"){let r=Math.round(t);t=r<1?void 0:r>8?{indent:8}:{indent:r}}if(n===void 0){let{keepUndefined:r}=t??e??{};if(!r)return}return te(n)&&!i?n.toString(t):new $e(n,i,t).toString(t)}var an={"schema:ethdebug/format/data/hex":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/data/hex"

title: ethdebug/format/data/hex
description: |
  A \`0x\`-prefixed hexadecimal string. This value **must** contain at least one
  hexadecimal character (\`0x\` by itself is not allowed).

type: string
pattern: "^0x[0-9a-fA-F]{1,}$"

examples:
  - "0x0000"
  - "0x1"
`,"schema:ethdebug/format/data/stamp":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/data/stamp"

title: ethdebug/format/data/stamp
description: |
  Names the schema an object conforms to and the version of the
  specification that defines that schema.

  \`schema\` is the name of the schema, for example
  \`ethdebug/format/program\`; the \`$id\` of that schema is \`schema:\`
  followed by this name. \`version\` is the version of the specification
  that defines it, as a semver string.

type: object

properties:
  schema:
    type: string
    title: Schema identifier
    description: |
      The name of the schema this object conforms to, for example
      \`ethdebug/format/program\`. The schema's \`$id\` is \`schema:\`
      followed by this name.

  version:
    type: string
    title: Specification version
    description: |
      The version of the specification that defines
      \`schema\`, as a semver string without build metadata.
    pattern: "^(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)(?:-((?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\\\.(?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$"

required:
  - schema
  - version

additionalProperties: false

examples:
  - schema: "ethdebug/format/program"
    version: "0.1.0-draft.1"
`,"schema:ethdebug/format/data/unsigned":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/data/unsigned"

title: ethdebug/format/data/unsigned
description: |
  A non-negative integer encoded as a JSON number.

type: integer
minimum: 0

examples:
  - 0
  - 100
`,"schema:ethdebug/format/data/value":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/data/value"

title: ethdebug/format/data/value
description: |
  A non-negative integer value, expressed either as a native JSON number or as
  a \`0x\`-prefixed hexadecimal string.

oneOf:
  - description: A non-negative integer literal
    $ref: "schema:ethdebug/format/data/unsigned"

  - description: |
      A \`0x\`-prefixed hexadecimal string representing literal bytes or a number
      commonly displayed in base 16 (e.g. bytecode instruction offsets).
    $ref: "schema:ethdebug/format/data/hex"

examples:
  - "0x0000"
  - 2
`,"schema:ethdebug/format/info/resources":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/info/resources"

title: ethdebug/format/info/resources
description: |
  An object containing lookup tables for finding debugging resources by name.

type: object

properties:
  ethdebug:
    title: Stamp
    description: |
      Names this schema and the specification version. A resources
      object must carry this field. All objects of one compilation
      must name the same \`version\`.
    allOf:
      - $ref: "schema:ethdebug/format/data/stamp"
      # note: whitespace chars are \\255 (nbsp)
      - title: '{\xA0"schema":\xA0"ethdebug/format/info/resources"\xA0}'
        properties:
          schema:
            $dynamicRef: "#SchemaName"

  types:
    title: Types by name
    description: |
      A collection of types by name identifier.
    type: object
    additionalProperties:
      $ref: "schema:ethdebug/format/type"

  pointers:
    title: Pointer templates by name
    description: |
      A collection of pointer templates by name identifier.
    type: object
    additionalProperties:
      $ref: "schema:ethdebug/format/pointer/template"

  compilation:
    $ref: "schema:ethdebug/format/materials/compilation"

required:
  - ethdebug
  - types
  - pointers

$defs:
  SchemaName:
    $dynamicAnchor: SchemaName
    description: |
      The schema name that the \`ethdebug\` field's \`schema\` must give. A
      schema that references this one can supply its own name here with
      a \`SchemaName\` dynamic anchor.
    const: "ethdebug/format/info/resources"

examples:
  - ethdebug:
      schema: "ethdebug/format/info/resources"
      version: "0.1.0-draft.1"
    types:
      "struct__Coordinate":
        kind: struct
        contains:
          - name: x
            type:
              kind: uint
              bits: 128
          - name: y
            type:
              kind: uint
              bits: 128
        definition:
          name: Coordinate
          location:
            source:
              id: 5
            range:
              offset: 18
              length: 55

    pointers:
      "struct__Coordinate__storage":
        expect:
          - contract_variable_slot__struct__Coordinate__storage
        for:
          group:
            - name: member__x__struct__Coordinate__storage
              location: storage
              slot: contract_variable_slot__struct__Coordinate__storage
              offset: 0
              length: 16
            - name: member__y__struct__Coordinate__storage
              location: storage
              slot: contract_variable_slot__struct__Coordinate__storage
              offset:
                ~sum:
                  - .offset: member__x__struct__Coordinate__storage
                  - .length: member__x__struct__Coordinate__storage
              length: 16
`,"schema:ethdebug/format/info":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/info"

title: ethdebug/format/info
description: |
  Debugging information about a single compilation

type: object

$ref: "schema:ethdebug/format/info/resources"

properties:
  ethdebug:
    title: Stamp
    description: |
      Names this schema and the specification version. An info document
      must carry this field. A program in \`programs\` should not carry
      one; the stamp of this document covers it. All objects of one
      compilation must name the same \`version\`.
    allOf:
      - $ref: "schema:ethdebug/format/data/stamp"
      # note: whitespace chars are \\255 (nbsp)
      - title: '{\xA0"schema":\xA0"ethdebug/format/info"\xA0}'
        properties:
          schema:
            $dynamicRef: "#SchemaName"

  programs:
    type: array
    items:
      $ref: "schema:ethdebug/format/program"

  compilation:
    $ref: "schema:ethdebug/format/materials/compilation"

required:
  - ethdebug
  - compilation
  - programs

unevaluatedProperties: false

$defs:
  SchemaName:
    $dynamicAnchor: SchemaName
    description: |
      The schema name that the \`ethdebug\` field's \`schema\` must give.
      This fills the slot that **ethdebug/format/info/resources**
      declares, so that an info document names **ethdebug/format/info**.
    const: "ethdebug/format/info"

examples:
  - ethdebug:
      schema: "ethdebug/format/info"
      version: "0.1.0-draft.1"
    compilation:
      id: __301f3b6d85831638
      compiler:
        name: egc
        version: 0.2.3+commit.8b37fa7a
      settings:
        turbo: true
      sources:
        - id: 1
          path: "Escrow.eg"
          language: examplelang
          contents: |
            import { Asset } from std::asset::fungible;

            type State = !slots[
              ready: bool,
              complete: bool,

              beneficiary: address,

              asset: Asset,
              amount: uint256,

              canRemit: () -> bool,
            ]

            @create
            func setup(
              beneficiary: address,
              asset: Asset,
              canRemit: () -> bool,
            ) -> State:
              return {
                ready = False,
                complete = False,
                beneficiary,
                asset,
                amount = 0,
                canRemit,
              }

            @abi
            @state(self: State)
            @account(self)
            func deposit(depositor: address, amount: uint256):
              require(!self.ready)
              require(!self.complete)

              # expects an existing allowance (also known as "approval")
              self.asset.transferFrom(depositor, self, amount)

              self.amount = amount
              self.ready = True

            @abi
            @state(self: State)
            func remit():
              require(self.ready)
              require(!self.complete)

              require(self.canRemit())

              asset.transfer(self.beneficiary, self.amount)

              self.complete = True

    types:
      # Define the State type structure
      State:
        kind: "struct"
        contains:
          - name: "ready"
            type:
              kind: "bool"
          - name: "complete"
            type:
              kind: "bool"
          - name: "beneficiary"
            type:
              kind: "address"
          - name: "asset"
            type:
              kind: "struct"
              contains:
                - name: "address"
                  type:
                    kind: "address"
          - name: "amount"
            type:
              kind: "uint"
              bits: 256
          - name: "canRemit"
            type:
              kind: "function"
              internal: true
              contains:
                parameters:
                  type:
                    kind: "tuple"
                    contains: []
                returns:
                  type:
                    kind: "bool"

    pointers:
      # Define storage layout for the State struct
      State_storage:
        expect: ["slot"]
        for:
          group:
            - name: "ready"
              location: "storage"
              slot: "slot"
              offset: 0
              length: 1
            - name: "complete"
              location: "storage"
              slot: "slot"
              offset: 1
              length: 1
            - name: "beneficiary"
              location: "storage"
              slot: { "~sum": ["slot", 1] }
            - name: "asset"
              location: "storage"
              slot: { "~sum": ["slot", 2] }
            - name: "amount"
              location: "storage"
              slot: { "~sum": ["slot", 3] }
            - name: "canRemit"
              location: "storage"
              slot: { "~sum": ["slot", 4] }

    programs:
      - contract:
          name: "Escrow"
          definition:
            source:
              id: 1
            range:
              offset: 0
              length: 891
        environment: "create"
        instructions:
          - offset: 0
            operation:
              mnemonic: "PUSH1"
              arguments: ["0x80"]
            context:
              code:
                source:
                  id: 1
                range:
                  offset: 891
                  length: 20
`,"schema:ethdebug/format/materials/compilation":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/compilation"

title: ethdebug/format/materials/compilation
description: |
  An object representing a single invocation of a compiler.

type: object
properties:
  id:
    description: |
      Compilation ID

      This value **should** be globally-unique and generated only from the
      compiler inputs (settings, sources, etc.); the same compiler inputs/
      settings **should** produce the same identifier.

    $ref: "schema:ethdebug/format/materials/id"

  compiler:
    type: object
    title: Compiler name and version
    properties:
      name:
        type: string
        description: Compiler name

      version:
        type: string
        description: |
          Compiler version.

          This value **should** be specified using the most detailed version
          representation available, i.e., including source control hash and
          compiler build information whenever possible.

    required:
      - name
      - version

    unevaluatedProperties: false

    examples:
      - name: lllc
        version: 0.4.12-develop.2017.6.27+commit.b83f77e0.Linux.g++

  settings:
    description: |
      Compiler settings in a format native to the compiler.

      For compilers whose settings includes full source representations, this
      field **should** be specified in such a way that avoids large data
      redundancies (e.g. if compiler settings contain full source
      representations, then this field would significantly duplicate the
      information represented by the \`sources\` field in this object).

      In situations where settings information duplicates information
      represented elsewhere in **ethdebug/format**, compilers **may** adopt
      any reasonable strategy, e.g.:
        - omit duplications partially (leaving the rest of the settings
          intact)
        - omit this field entirely
        - specify this field as a hash of the full settings
          representation (with the expectation that users of this format will
          have access to the full representation by some other means)

    allOf:
      - true

  sources:
    type: array
    items:
      $ref: "schema:ethdebug/format/materials/source"

required:
  - id
  - compiler
  - sources

unevaluatedProperties: false

examples:
  - id: foo
    compiler:
      name: lllc
      version: 0.4.12-develop.2017.6.27+commit.b83f77e0.Linux.g++
    sources:
      - id: 0
        path: stdin
        contents: |
          (add 1 (mul 2 (add 3 4)))
        language: LLL
`,"schema:ethdebug/format/materials/encoding":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/encoding"

title: ethdebug/format/materials/encoding
description: |
  A character encoding, identified by a label from the WHATWG Encoding
  Standard (https://encoding.spec.whatwg.org/).

  The value **must** be a label that the Standard defines \u2014 for example
  \`utf-8\`, \`utf-16le\`, or \`windows-1252\`. Where the Standard lists several
  labels for the same encoding, its canonical (lowercase) name is
  preferred (\`utf-16le\` rather than \`utf-16\`, which the Standard treats as
  a label for the same encoding). Because these are exactly the labels the
  \`TextDecoder\` API accepts, a JavaScript consumer can pass the value
  straight to \`new TextDecoder(label)\`.

  Where a field of this type is optional and omitted, the encoding is
  \`utf-8\`.

type: string

examples:
  - utf-8
  - utf-16le
  - windows-1252
`,"schema:ethdebug/format/materials/id":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/id"

title: ethdebug/format/materials/id
description: |
  An opaque identifier for a compilation resource (such as a source
  file or a compilation itself), typically generated by the compiler.
  Values may be numeric or string and **must** be unique within the
  scope where they appear (e.g., source IDs within a single
  compilation).

type:
  - number
  - string

examples:
  # example: numeric source index
  - 0
  # example: content-addressed compilation ID
  - "__301f3b6d85831638"
`,"schema:ethdebug/format/materials/reference":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/reference"

title: ethdebug/format/materials/reference
description: A reference to an external resource by ID

type: object
properties:
  id:
    $ref: "schema:ethdebug/format/materials/id"

  type:
    enum:
      - compilation
      - source

required: [id]

unevaluatedProperties: false

examples:
  - id: 1
`,"schema:ethdebug/format/materials/source-range":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/source-range"

title: ethdebug/format/materials/source-range
description: |
  A range of bytes in a particular source.

  Note that this refers to the bytes range in the original character encoding
  for the source, not the character encoding used for strings in this JSON
  format (UTF-8). For compilers that support input sources in encodings other
  than this format's transmission encoding, compilers **must** address source
  ranges in this original encoding, and debuggers **must** re-encode source
  contents obtained from this format _before_ performing any range addressing.

  (Compilers that only accept UTF-8 or ASCII are naturally exempt from this
  concern.)

type: object
properties:
  compilation:
    title: Compilation reference by ID
    $ref: "schema:ethdebug/format/materials/reference"

  source:
    title: Source reference by ID
    $ref: "schema:ethdebug/format/materials/reference"

  range:
    title: Bytes range within source contents
    description: |
      Ranges that span the entire source contents **may** omit this field
      as a shorthand. This field is otherwise **required**.
    type: object
    properties:
      offset:
        description: |
          Byte offset at beginning of range.
        $ref: "schema:ethdebug/format/data/value"

      length:
        description: Number of bytes contained in range
        $ref: "schema:ethdebug/format/data/value"

    unevaluatedProperties: false

    required:
      - offset
      - length

unevaluatedProperties: false

required:
  - source

examples:
  - source:
      id: 5
    range:
      offset: 20
      length: 100
`,"schema:ethdebug/format/materials/source":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/source"

title: ethdebug/format/materials/source
description: |
  An object representing one unit of compiler input, the raw text contents and
  identifying metadata (such as file path) that were given to the compiler as
  part of a compilation.

type: object
properties:
  id:
    description: |
      Source identifier. This field **must** be unique for all sources
      within a single compiler invocation (compilation).
    $ref: "schema:ethdebug/format/materials/id"

  path:
    type: string
    description: |
      Hierarchical file-system-like path to this source. This value may
      be an absolute path, a path relative to some root directory, a path
      to some resource within a package, etc.

      This value does not need to correspond to any file on disk (either
      physical or virtual), and might instead refer to a path identifier
      for a source that was generated by a compiler or other development tool.

      This format makes no specific restrictions on how paths should be
      specified (e.g., no restriction on path separators, etc.), other than
      that values for this field should match what users observe elsewhere for
      the inputs/outputs of this particular compiler invocation.

      If no path information is available for a particular source, e.g. if the
      source was provided to the compiler via shell standard input, this field
      should indicate that somehow (e.g., specifying \`"path": "stdin"\` or
      similar).

      This field's value **should** be unique across all sources within the
      same compilation.

  contents:
    description: |
      The full contents of the source, possibly re-encoded as UTF-8 to
      match parent JSON encoding.

      In cases where input source used a different encoding, this object
      **must** also specify an \`encoding\` property to indicate the
      encoding originally used. Where relevant, debuggers **must** also
      convert these \`contents\` back to the specified original encoding so
      as to match code author expectations.

    type: string

  encoding:
    description: |
      Character encoding of the original source \`contents\`. This property
      is **required** if that encoding does not match the JSON transmission
      encoding (UTF-8), since the value of the \`contents\` property will
      represent the text of the source in this JSON encoding.

      This property **must not** appear in objects that do not specify
      a \`contents\` property.

    $ref: "schema:ethdebug/format/materials/encoding"

  language:
    description: |
      The high-level language that the source contents are written in.

    type: string

required:
  - id
  - path
  - contents
  - language

unevaluatedProperties: false

examples:
  - id: 5
    path: ./contracts/SimpleStorage.sol
    contents: |
      // SPDX-License-Identifier: GPL-3.0
      pragma solidity >=0.4.16 <0.9.0;

      contract SimpleStorage {
          uint storedData;

          function set(uint x) public {
              storedData = x;
          }

          function get() public view returns (uint) {
              return storedData;
          }
      }

    language: Solidity
`,"schema:ethdebug/format/pointer/collection/conditional":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/conditional"

title: ethdebug/format/pointer/collection/conditional
description: |
  A pointer defined conditionally based on the non-zero-ness of some expression

type: object

properties:
  if:
    $ref: "schema:ethdebug/format/pointer/expression"
  then:
    $ref: "schema:ethdebug/format/pointer"
  else:
    $ref: "schema:ethdebug/format/pointer"

required:
  - if
  - then

additionalProperties: false

examples:
  - if: 0
    then:
      location: memory
      offset: 0
      length: 1
    else:
      location: memory
      offset: 1
      length: 1
`,"schema:ethdebug/format/pointer/collection/group":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/group"

title: ethdebug/format/pointer/collection/group
description: |
  A composite collection of pointers
type: object
properties:
  group:
    type: array
    items:
      $ref: "schema:ethdebug/format/pointer"
    minItems: 1
required:
  - group
additionalProperties: false

examples:
  - group:
      - name: "data-pointer"
        location: stack
        slot: 0
      - location: memory
        offset:
          ~read: "data-pointer"
        length: 32
`,"schema:ethdebug/format/pointer/collection/list":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/list"

title: ethdebug/format/pointer/collection/list
description: |
  An ordered list of pointers, indexed starting at zero.
type: object
properties:
  list:
    type: object
    properties:
      count:
        description: |
          The size of the list that this collection represents.
        $ref: "schema:ethdebug/format/pointer/expression"
      each:
        description: |
          An identifier name whose value as an expression resolves to the index
          in the list
        $ref: "schema:ethdebug/format/pointer/identifier"
      is:
        description: |
          The dynamically-generated pointer repeated as a list
        $ref: "schema:ethdebug/format/pointer"
    required:
      - count
      - each
      - is
    additionalProperties: false

required:
  - list

additionalProperties: false

examples:
  - list:
      count: 5
      each: "index"
      is:
        location: memory
        offset: "index"
        length: 1
`,"schema:ethdebug/format/pointer/collection/reference":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/reference"

title: ethdebug/format/pointer/collection/reference
description: |
  A pointer by named reference to a pointer template (defined elsewhere).

type: object

properties:
  template:
    title: Template identifier
    $ref: "schema:ethdebug/format/pointer/identifier"

  yields:
    title: Region name mapping
    description: |
      Maps region names produced by the template to new names for use
      outside the template. Unmapped region names pass through unchanged.
      When omitted, all regions keep their original names.
    type: object
    propertyNames:
      $ref: "schema:ethdebug/format/pointer/identifier"
    additionalProperties:
      $ref: "schema:ethdebug/format/pointer/identifier"

required:
  - template

additionalProperties: false

examples:
  - template: "string-storage-pointer"

  - template: "string-storage-pointer"
    yields:
      data: "name-data"
      length: "name-length"
`,"schema:ethdebug/format/pointer/collection/scope":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/scope"

title: ethdebug/format/pointer/collection/scope
description: |
  A pointer defined with the aid of additional variables with values specified
  as expressions.

  Variables are specified by the \`define\` field as an object mapping of
  expression by identifier. Variables are specified **in order**, so that
  later appearing variables may reference earlier ones in the same object.

  The variables are visible only within \`in\`. Pointers outside this scope
  do not see them: later members of an enclosing group, for example, see
  only the variables of their own enclosing scopes. A variable defined here
  with the same identifier as an outer variable shadows it within \`in\`.

type: object

properties:
  define:
    title: Mapping of variables to expression value
    type: object
    propertyNames:
      $ref: "schema:ethdebug/format/pointer/identifier"
    additionalProperties:
      $ref: "schema:ethdebug/format/pointer/expression"
  in:
    $ref: "schema:ethdebug/format/pointer"

required:
  - define
  - in

additionalProperties: false

examples:
  - define:
      example-offset:
        ~sum: [1, 2]
      example-length:
        ~product: [2, ~wordsize]
    in:
      name: example
      location: memory
      offset: example-offset
      length: example-length
`,"schema:ethdebug/format/pointer/collection/templates":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection/templates"

title: ethdebug/format/pointer/collection/templates
description: |
  A pointer with locally-defined templates available for use within.

  Templates defined here are available by name for reference collections
  inside the \`in\` pointer.

type: object

properties:
  templates:
    title: Mapping of template names to template definitions
    type: object
    propertyNames:
      $ref: "schema:ethdebug/format/pointer/identifier"
    additionalProperties:
      $ref: "schema:ethdebug/format/pointer/template"
  in:
    $ref: "schema:ethdebug/format/pointer"

required:
  - templates
  - in

additionalProperties: false

examples:
  - templates:
      simple-slot:
        expect: ["slot"]
        for:
          location: storage
          slot: "slot"
    in:
      define:
        slot: 0
      in:
        template: "simple-slot"
`,"schema:ethdebug/format/pointer/collection":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/collection"

title: ethdebug/format/pointer/collection
description: |
  A representation of a collection of pointers to data in the EVM
type: object
allOf:
  - oneOf:
      - required: [group]
      - required: [list]
      - required: [if]
      - required: [define]
      - required: [template]
      - required: [templates]

  - if:
      required: [group]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/group"

  - if:
      required: [list]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/list"

  - if:
      required: [if]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/conditional"

  - if:
      required: [define]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/scope"

  - if:
      required: [template]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/reference"

  - if:
      required: [templates]
    then:
      $ref: "schema:ethdebug/format/pointer/collection/templates"
`,"schema:ethdebug/format/pointer/expression":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/expression"

title: ethdebug/format/pointer/expression
description: |
  A schema for describing expressions that evaluate to values.

  ## Two sorts of value: integers and bytes

  Every expression evaluates to a value of one of two sorts:

  - an **integer** \u2014 an unbounded, non-negative integer. It has a numeric
    value but **no width**. Arithmetic is ordinary integer arithmetic.
  - **bytes** \u2014 a finite sequence of bytes with a definite **width** (its
    byte length).

  The two sorts are produced by different forms:

  - **Integers** are produced by a JSON-number literal, the \`~wordsize\`
    constant, a variable or lookup (\`.offset\` / \`.length\` / \`.slot\`) that
    denotes an index or count, an arithmetic operation (\`~sum\`,
    \`~difference\`, \`~product\`, \`~quotient\`, \`~remainder\`), and a
    hexadecimal literal that has an **odd** number of digits (which has no
    whole-byte width \u2014 see \`Literal\`).
  - **Bytes** are produced by a hexadecimal literal with an **even** number
    of digits (its width is the number of bytes written), \`~read\` (its
    width is the length of the region read), the resize forms
    \`~sizedN\` / \`~wordsized\` (whose width is \`N\` / the word size),
    \`~keccak256\` (width 32), and \`~concat\` (width the sum of its operands').

  ## Coercion and the width-bearing requirement

  Where an **integer** is expected \u2014 arithmetic operands, a list \`count\`, a
  segment \`slot\` / \`offset\` / \`length\` \u2014 a bytes value is accepted and read
  as the non-negative integer its bytes encode (big-endian).

  Where **bytes** are expected \u2014 the operands of \`~concat\` and \`~keccak256\`,
  whose results depend on operand widths \u2014 the operand **must** be
  width-bearing. A bare integer (a JSON number, an odd-digit hex literal,
  \`~wordsize\`, an arithmetic result, or a lookup) is **not** valid there:
  give it a width first with \`~sizedN\` or \`~wordsized\`. There is no
  implicit widening; the resize forms are the only bridge from an integer
  to bytes.

oneOf:
  - $ref: "#/$defs/Literal"
  - $ref: "#/$defs/Variable"
  - $ref: "#/$defs/Constant"
  - $ref: "#/$defs/Arithmetic"
  - $ref: "#/$defs/Lookup"
  - $ref: "#/$defs/Read"
  - $ref: "#/$defs/Keccak256"
  - $ref: "#/$defs/Concat"
  - $ref: "#/$defs/Resize"

$defs:
  Literal:
    title: Literal value
    description: |
      A literal value, written either as a JSON number or as a \`0x\`-prefixed
      hexadecimal string.

      Its sort follows its form:

      - a JSON number is an **integer** (no width);
      - a hexadecimal string with an **even** number of digits is **bytes**,
        whose width is the number of bytes written (\`"0x00"\` is one zero
        byte, \`"0xdead"\` is two bytes);
      - a hexadecimal string with an **odd** number of digits has no
        whole-byte width and is therefore an **integer**, equal to the value
        its digits denote (\`"0x1"\` is the integer \`1\`, not bytes).

    $ref: "schema:ethdebug/format/data/value"

    examples:
      - 5
      - "0x0000000000000000000000000000000000000000000000000000000000000000"

  Constant:
    title: Constant value
    type: string
    enum:
      - ~wordsize

  Variable:
    title: Variable identifier
    description: |
      A string that matches an identifier used in an earlier declaration of
      a scalar variable. This expression evaluates to the value of that
      variable.
    $ref: "schema:ethdebug/format/pointer/identifier"

  Arithmetic:
    title: Arithmetic operation
    description: |
      Ordinary integer arithmetic. Each operand is taken as an **integer**
      (a bytes operand is read as the non-negative integer its bytes encode),
      and the result is an **integer** with no width. To use an arithmetic
      result where bytes are required, give it a width with \`~sizedN\` or
      \`~wordsized\`.
    type: object
    properties:
      "~sum":
        description: |
          A list of expressions to be added together.
        $ref: "#/$defs/Operands"
      "~difference":
        description: |
          A tuple of two expressions where the second is to be subtracted from
          the first.

          If the second operand is larger than the first, the result of this
          arithmetic operation is defined to equal zero (\`0\`).

          (i.e., \`{ "~difference": [a, b] }\` equals \`a\` minus \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
      "~product":
        description: |
          A list of expressions to be multiplied.
        $ref: "#/$defs/Operands"
      "~quotient":
        description: |
          A tuple of two expressions where the first corresponds to the
          dividend and the second corresponds to the divisor, for the purposes
          of doing integer division.

          (i.e., \`{ "~quotient": [a, b] }\` equals \`a\` divided by \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
      "~remainder":
        description: |
          A tuple of two expressions where the first corresponds to the
          dividend and the second corresponds to the divisor, for the purposes
          of computing the modular-arithmetic remainder.

          (i.e., \`{ "~remainder": [a, b] }\` equals \`a\` mod \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
    additionalProperties: false
    minProperties: 1
    maxProperties: 1
    examples:
      - "~sum": [5, 3, 4]
      - "~difference": [5, 3]
      - "~product": [5, 3, 0]
      - "~quotient": [5, 3]
      - "~remainder":
          - "~product":
              - 2
              - 2
              - 2
              - 2
          - 3

  Operands:
    type: array
    items:
      $ref: "schema:ethdebug/format/pointer/expression"

  Lookup:
    title: Lookup region definition
    description: |
      An object of the form \`{ ".<property-name>": "<region>" }\`, to
      denote that this expression is equivalent to the defined value for
      the property named \`<property-name>\` inside the region referenced as
      \`<region>\`. The value is an **integer** (a region's \`.offset\`,
      \`.length\`, or \`.slot\`).

      \`<property-name>\` **must** be a valid and present property on the
      corresponding region, or it **must** correspond to an optional property
      whose schema specifies a default value for that property.
    type: object
    patternProperties:
      "^\\\\.(offset|length|slot)$":
        $ref: "#/$defs/Reference"
    additionalProperties: false
    minProperties: 1
    maxProperties: 1

    examples:
      - .offset: "array-count"
      - .length: "array-item"
      - .offset: ~this

  Read:
    title: Read region bytes
    description: |
      An object of the form \`{ "~read": "<region>" }\`. The value of this
      expression equals the raw bytes present in the running machine state
      in the referenced region. The result is **bytes** whose width is the
      length of the region read.
    type: object
    properties:
      ~read:
        $ref: "#/$defs/Reference"
    required:
      - ~read
    additionalProperties: false
    examples:
      - ~read: "struct-start"

  Reference:
    title: Region reference
    description: |
      A string value that **must** either be the \`"name"\` of at least one
      region declared with \`{ "name": "<region>" }\` previously in some root
      pointer representation, or it **must** be the literal value \`"~this"\`,
      which indicates a reference to the region containing this expression.

      If more than one region is defined with the same name, resolution is
      defined as firstly resolving to the latest earlier sibling that declares
      the matching name, then secondly resolving to the parent if it matches,
      then to parent's earlier siblings, and so on.
    type: string
    oneOf:
      - $ref: "schema:ethdebug/format/pointer/identifier"
      - const: "~this"
        description: |
          Indicates a reference to the region containing this expression.
          A property lookup via \`~this\` (e.g. \`{ ".length": "~this" }\`) must
          not be circular: the referenced property must be resolvable without
          depending on the value currently being defined.

  Keccak256:
    title: Keccak256 hash
    description: |
      An object of the form \`{ "~keccak256": [...values] }\`, indicating
      that this expression evaluates to the Solidity-style keccak256 hash
      of the tightly-packed bytes encoded by \`values\`. The result is
      **bytes** of width 32.

      Because the hash is taken over the concatenation of the operands'
      bytes, each operand **must** be width-bearing (bytes): a bare integer
      is not valid here and must be given a width first with \`~sizedN\` or
      \`~wordsized\`. This is why a mapping-slot computation word-sizes its key
      and slot before hashing.
    type: object
    properties:
      ~keccak256:
        title: Array of hashed values
        type: array
        items:
          $ref: "schema:ethdebug/format/pointer/expression"
    additionalProperties: false
    required:
      - ~keccak256
    examples:
      - ~keccak256:
          - ~wordsized: 0
          - "0x00"

  Concat:
    title: Concatenate values
    description: |
      An object of the form \`{ "~concat": [...values] }\`, indicating that this
      expression evaluates to the concatenation of bytes from each value.
      The byte width of each operand is preserved; no padding is added or
      removed between operands. The result is **bytes** whose width is the
      sum of the operand widths.

      Each operand **must** be width-bearing (bytes): a bare integer is not
      valid here and must be given a width first with \`~sizedN\` or
      \`~wordsized\`.
    type: object
    properties:
      ~concat:
        title: Array of values to concatenate
        type: array
        items:
          $ref: "schema:ethdebug/format/pointer/expression"
    additionalProperties: false
    required:
      - ~concat
    examples:
      - ~concat:
          - "0x00"
          - "0x00"
      - ~concat:
          - "0xdead"
          - "0xbeef"
      - ~concat: []

  Resize:
    title: Resize data
    description: |
      A resize operation produces **bytes** of a definite width, and is the
      bridge from an integer to bytes: give it an integer (or bytes) and it
      yields bytes of the requested width.

      A resize operation expression is either an object of the form
      \`{ "~sized<N>": <expression> }\` or an object of the form
      \`{ "~wordsized": <expression> }\`, where \`<expression>\` is an expression
      whose value is to be resized, and, if applicable, where \`<N>\` is the
      smallest decimal representation of an unsigned integer.

      This object's value is evaluated as follows, based on the bytes width of
      the value \`<expression>\` evaluates to and based on \`<N>\` (using the
      value of \`"~wordsize"\` for \`<N>\` in the case of the latter form above):
      - If the width equals \`<N>\`, this object evaluates to the same value as
        \`<expression>\` (equivalent to the identity function or no-op).
      - If the width is less than \`<N>\`, this object evaluates to the same value
        as \`<expression>\` but with additional zero-bytes (\`0x00\`) prepended on
        the left (most significant) side, such that the resulting bytes width
        equals \`<N>\`.
      - If the width exceeds \`<N>\`, this object evaluates to the same value
        as \`<expression>\` but with a number of bytes removed from the left
        (most significant) side until the bytes width equals \`<N>\`.

      (These cases match the behavior that Solidity uses for resizing its
      \`bytesN\`/\`uintN\` types.)
    type: object
    oneOf:
      - title: Resize to literal number of bytes
        type: object
        patternProperties:
          "^~sized([1-9]+[0-9]*)$":
            $ref: "schema:ethdebug/format/pointer/expression"
        additionalProperties: false
      - title: Resize to word-size
        type: object
        patternProperties:
          "^~wordsized$":
            $ref: "schema:ethdebug/format/pointer/expression"
        additionalProperties: false
    minProperties: 1
    maxProperties: 1
    examples:
      - ~sized2: "0x00" # 0x0000
      - ~sized2: "0xffffff" # 0xffff
      - ~wordsized: "0x00" # 0x0000000000000000000000000000000000000000000000000000000000000000

examples:
  - 0
  - ~sum:
      - .offset: "array-start"
      - .length: "array-start"
      - 1
  - ~keccak256:
      - ~wordsized: 5
      - ~wordsized:
          .offset: "array-start"
`,"schema:ethdebug/format/pointer/identifier":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/identifier"

title: ethdebug/format/pointer/identifier
description: |
  An identifier for use within the context of a root pointer

  An identifier **must not** start with \`~\`: that prefix is reserved for the
  format's own terms in pointer expressions (e.g., \`~wordsize\`, \`~this\`,
  \`~sum\`), so a name can never be confused with one of them.
type: string
pattern: "^[a-zA-Z_\\\\-]+[a-zA-Z0-9$_\\\\-]*$"

examples:
  - a
  - a0
  - -$
  - __init__
`,"schema:ethdebug/format/pointer/region/base":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/base"

title: ethdebug/format/pointer/region/base
description: |
  Common schema for all region schemas, regardless of \`"location": ...\`.

type: object
properties:
  name:
    $ref: "schema:ethdebug/format/pointer/identifier"

  location:
    type: string

required:
  - location

examples:
  - name: "array-item"
    location: memory
`,"schema:ethdebug/format/pointer/region/calldata":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/calldata"

title: ethdebug/format/pointer/region/calldata
description: |
  A schema for representing a region of data in message calldata.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"calldata"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: calldata

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: calldata
    offset: "0x04"
    length: 32
`,"schema:ethdebug/format/pointer/region/code":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/code"

title: ethdebug/format/pointer/region/code
description: |
  A schema for representing a region of data in EVM bytecode.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"code"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: code

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: code
    offset: "0x04"
    length: 32
`,"schema:ethdebug/format/pointer/region/memory":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/memory"

title: ethdebug/format/pointer/region/memory
description: |
  A schema for representing a region of data in EVM memory. Pointer regions
  within memory represent a single/atomic sequence of byte locations.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"memory"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: memory

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: memory
    offset: "0x04"
    length: 32
`,"schema:ethdebug/format/pointer/region/returndata":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/returndata"

title: ethdebug/format/pointer/region/returndata
description: |
  A schema for representing a region of data in message returndata.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"returndata"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: returndata

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: returndata
    offset: "0x04"
    length: 32
`,"schema:ethdebug/format/pointer/region/stack":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/stack"

title: ethdebug/format/pointer/region/stack
description: |
  A schema for representing a region of data in the EVM.

  Describes stack slots as number of positions from the top (at time of
  observation). Debuggers reading this information **should** immediately
  convert these positions to absolute positions from the bottom.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"stack"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: stack

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: stack
    slot: 0
  - location: stack
    slot: 1
    length:
      ~product:
        - ~wordsize
        - 2
`,"schema:ethdebug/format/pointer/region/storage":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/storage"

title: ethdebug/format/pointer/region/storage
description: |
  A schema for representing a region of data in EVM storage.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"storage"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: storage

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: storage
    slot: "0x03"
  - location: storage
    slot: "0x06"
    length:
      ~product:
        - ~wordsize
        - 2
  - location: storage
    slot: "0x08"
    offset:
      ~quotient:
        - ~wordsize
        - 2
    length:
      ~quotient:
        - ~wordsize
        - 2
`,"schema:ethdebug/format/pointer/region/transient":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/transient"

title: ethdebug/format/pointer/region/transient
description: |
  A schema for representing a region of data in EVM transient storage.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"transient"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: transient

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: transient
    slot: "0x03"
  - location: transient
    slot: "0x06"
    length:
      ~product:
        - ~wordsize
        - 2
  - location: transient
    slot: "0x08"
    offset:
      ~quotient:
        - ~wordsize
        - 2
    length:
      ~quotient:
        - ~wordsize
        - 2
`,"schema:ethdebug/format/pointer/region":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region"

title: ethdebug/format/pointer/region
description: |
  A representation of a region of data in the EVM
type: object
properties:
  location:
    $ref: "#/$defs/Location"

required:
  - location

allOf:
  - if:
      required:
        - location
      properties:
        location:
          const: stack
    then:
      $ref: "schema:ethdebug/format/pointer/region/stack"

  - if:
      required:
        - location
      properties:
        location:
          const: memory
    then:
      $ref: "schema:ethdebug/format/pointer/region/memory"

  - if:
      required:
        - location
      properties:
        location:
          const: storage
    then:
      $ref: "schema:ethdebug/format/pointer/region/storage"

  - if:
      required:
        - location
      properties:
        location:
          const: calldata
    then:
      $ref: "schema:ethdebug/format/pointer/region/calldata"

  - if:
      required:
        - location
      properties:
        location:
          const: returndata
    then:
      $ref: "schema:ethdebug/format/pointer/region/returndata"

  - if:
      required:
        - location
      properties:
        location:
          const: transient
    then:
      $ref: "schema:ethdebug/format/pointer/region/transient"

  - if:
      required:
        - location
      properties:
        location:
          const: code
    then:
      $ref: "schema:ethdebug/format/pointer/region/code"

$defs:
  Location:
    type: string
    enum:
      - stack
      - memory
      - storage
      - calldata
      - returndata
      - transient
      - code

unevaluatedProperties: false

examples:
  - location: storage
    slot: "0x0000000000000000000000000000000000000000000000000000000000000000"
`,"schema:ethdebug/format/pointer/scheme/segment":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/scheme/segment"

title: ethdebug/format/pointer/scheme/segment
description: |
  An addressing scheme for pointing to a range of bytes in a data location
  arranged as individually-addressable word-sized slots.

  **Note** that this addressing scheme permits addressing byte ranges that
  extend beyond the last byte of a particular slot, or even covering the range
  of multiple slots.

  In such cases, this schema defines the range as the concatenation of bytes
  across slots such that the address of the first byte after the end of slot
  \`p\` (i.e., \`{ "offset": "~wordsize" }\`) is interpreted as the first byte of
  slot \`p + 1\`.

type: object

properties:
  slot:
    $ref: "schema:ethdebug/format/pointer/expression"
  offset:
    description: |
      The starting byte index within the slot.

      Bytes within a slot are numbered from the most significant byte. A
      slot's value is its \`~wordsize\`-byte big-endian word, and byte \`0\` is
      the first byte of that word, as if the word were written to memory. An
      \`offset\` of \`0\` therefore addresses the most significant byte of the
      slot, and an \`offset\` of \`~wordsize - 1\` addresses the least
      significant byte.

      This field is **optional**. If unspecified, it has the default value of
      \`0\`, indicating that the segment begins at the start of the specified
      slot (its most significant byte).

      A data layout that counts bytes from the low-order end of a slot must
      convert: a value of \`n\` bytes that sits \`o\` bytes from the low-order end
      is at \`offset\` \`~wordsize - o - n\`. An emitter may write that number as
      a literal, which is the simplest form to read and resolve. It may also
      write the conversion as an expression, such as

      \`\`\`json
      {
        "~difference": ["~wordsize", { "~sum": [o, { ".length": "~this" }] }]
      }
      \`\`\`

      which can take \`n\` from the region's own \`length\`, keeps the layout's
      own numbers visible, needs no arithmetic in the emitter, and does not
      depend on a fixed word size.

      This field's expression must resolve to a non-negative value. It is
      **not** bounded by the word size: an offset that meets or exceeds
      \`~wordsize\` carries into subsequent slots. Given a \`slot\` value \`p\`
      and an \`offset\` value \`n\`, the segment begins at byte
      \`n mod ~wordsize\` of slot \`p + floor(n / ~wordsize)\`. (Equivalently,
      byte \`{ "offset": "~wordsize" }\` of slot \`p\` is byte \`0\` of slot
      \`p + 1\`, consistent with the multi-slot note above.) Emitters may
      therefore chain byte sums across a slot boundary without decomposing
      into slot and byte components themselves; a resolver recovers the
      effective slot and byte by division and remainder against
      \`~wordsize\`.
    $ref: "schema:ethdebug/format/pointer/expression"
    default: 0
  length:
    description: |
      The length of the bytes range this segment represents.

      This field is **optional**. If unspecified, its default value indicates
      that the segment ends at the end of the slot in which it begins (after
      applying any \`offset\` carry).

      If this field has value larger than the default value, i.e., if the
      segment extends beyond the last byte in the slot, then this segment is
      defined to be the concatenation of the sequentially-addressed slot(s)
      following the slot specified.
    $ref: "schema:ethdebug/format/pointer/expression"
    default:
      ~difference:
        - ~wordsize
        - ~remainder:
            - .offset: ~this
            - ~wordsize

required:
  - slot

examples:
  - slot: 0
  - slot: 1
    length:
      ~product:
        - ~wordsize
        - 3
  # a carry example: an offset at or beyond \`~wordsize\` addresses a later
  # slot. Here \`offset: ~wordsize\` is byte 0 of slot 1, so this segment is
  # the 4 bytes beginning there.
  - slot: 0
    offset: ~wordsize
    length: 4
  # packed values: an \`address\` (20 bytes) at the low-order end of slot 2,
  # and a \`uint32\` (4 bytes) just above it, written with literal offsets
  - slot: 2
    offset: 12
    length: 20
  - slot: 2
    offset: 8
    length: 4
  # the same two values with the conversion \`~wordsize - (o + n)\` written as
  # an expression that takes \`n\` from the region's own length
  - slot: 2
    offset:
      ~difference:
        - ~wordsize
        - .length: ~this
    length: 20
  - slot: 2
    offset:
      ~difference:
        - ~wordsize
        - ~sum:
            - 20
            - .length: ~this
    length: 4
`,"schema:ethdebug/format/pointer/scheme/slice":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/scheme/slice"

title: ethdebug/format/pointer/scheme/slice
description: |
  An addressing scheme for pointing to a range of sequential bytes inside
  a data location whose structure is that of a regular bytes array
  (i.e., where bytes are indexed by byte offset, with no concept of word).

type: object

properties:
  offset:
    description: |
      The index of the byte (starting from zero) in the data location where
      the slice begins.
    $ref: "schema:ethdebug/format/pointer/expression"
  length:
    description: |
      The length of the slice in number of bytes.
    $ref: "schema:ethdebug/format/pointer/expression"

required:
  - offset
  - length

examples:
  - offset: 0
    length: 32
`,"schema:ethdebug/format/pointer/template":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/template"

title: ethdebug/format/pointer/template
description: |
  A schema for representing a pointer defined in terms of some variables whose
  values are to be provided when invoking the template.

type: object
properties:
  expect:
    title: Template variables
    description: |
      An array of variable identifiers used in the definition of the
      pointer template.
    type: array
    items:
      $ref: "schema:ethdebug/format/pointer/identifier"

  for:
    $ref: "schema:ethdebug/format/pointer"

required:
  - expect
  - for

additionalProperties: false

examples:
  - expect: ["slot"]
    for:
      location: storage
      slot: "slot"
`,"schema:ethdebug/format/pointer":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer"

title: ethdebug/format/pointer
description: |
  A schema for representing a pointer to a data position or a range of data
  positions in the EVM.

  An **ethdebug/format/pointer** is either a single region or a structured
  collection of other pointers.

type: object

if:
  required: [location]
then:
  $ref: "schema:ethdebug/format/pointer/region"
else:
  $ref: "schema:ethdebug/format/pointer/collection"

examples:
  - # example: a single particular storage slot
    location: storage
    slot: 2

  - # example \`uint256[] memory\` allocation pointer
    define:
      "uint256-array-memory-pointer-slot": 0
    in:
      # this pointer composes an ordered list of other pointers
      group:
        # declare the first sub-pointer to be the "array-start" region of data
        # corresponding to the first item in the stack (at time of observation)
        - name: "array-start"
          location: stack
          slot: "uint256-array-memory-pointer-slot"

        # declare the "array-count" region to be at the offset indicated by
        # the value at "array-start"
        - name: "array-count"
          location: memory
          offset:
            ~read: "array-start"
          length: ~wordsize

        # thirdly, declare a sub-pointer that is a dynamic list whose size is
        # indicated by the value at "array-count", where each "item-index"
        # corresponds to a discrete "array-item" region
        - list:
            count:
              ~read: "array-count"
            each: "item-index"
            is:
              name: "array-item"
              location: "memory"
              offset:
                # array items are positioned so that the item with index 0
                # immediately follows "array-count", and each subsequent item
                # immediately follows the previous.
                ~sum:
                  - .offset: "array-count"
                  - .length: "array-count"
                  - ~product:
                      - "item-index"
                      - .length: ~this
              length: ~wordsize

  - # example \`struct Record { uint8 x; uint8 y; bytes4 salt; }\` in storage
    #
    # this example defines the "packed-field" template inline and demonstrates
    # how templates can be reused with \`yields\` to rename regions.
    # each field is placed by packing right-to-left from the previous offset.
    templates:
      packed-field:
        expect:
          - "struct-storage-contract-variable-slot"
          - "previous"
          - "size"
        for:
          name: "field"
          location: storage
          slot: "struct-storage-contract-variable-slot"
          offset:
            ~difference: ["previous", "size"]
          length: "size"
    in:
      define:
        "struct-storage-contract-variable-slot": 0
      in:
        group:
          # sentinel region marking where packing begins (end of word)
          - name: "packing-begin"
            location: storage
            slot: "struct-storage-contract-variable-slot"
            offset: ~wordsize
            length: 0

          - define: { previous: { .offset: "packing-begin" }, size: 1 }
            in:
              template: "packed-field"
              yields: { "field": "x" }

          - define: { previous: { .offset: "x" }, size: 1 }
            in:
              template: "packed-field"
              yields: { "field": "y" }

          - define: { previous: { .offset: "y" }, size: 4 }
            in:
              template: "packed-field"
              yields: { "field": "salt" }

  - # example \`(struct Record { uint256 x; uint256 y; })[] memory\`
    group:
      # declare the first sub-pointer to be the "array-start" region of data
      # corresponding to the first item in the stack (at time of observation)
      - name: "array-start"
        location: stack
        slot: 0

      # declares the "array-count" region in memory at the offset indicated
      # by "array-start" and of length equal to word size
      - name: "array-count"
        location: memory
        offset:
          ~read: "array-start"
        length: ~wordsize

      # declare this to include a list of pointers of size indicated by the
      # value at "array-count", where each "item-index" corresponds to a
      # group of pointers
      - list:
          count:
            ~read: "array-count"
          each: "item-index"
          is:
            group:
              # each element in the list includes a "struct-pointer" region
              # in memory (laid out sequentially in a block as the raw
              # array data)
              - name: "struct-pointer"
                location: memory
                offset:
                  ~sum:
                    - .offset: "array-count"
                    - .length: "array-count"
                    - ~product:
                        - "item-index"
                        - .length: ~this
                length: ~wordsize

              # following that pointer leads to the region corresponding to
              # the first member of the struct
              - name: "struct-member-0"
                location: memory
                offset:
                  ~read: "struct-pointer"
                length: ~wordsize

              # the second struct member immediately follows the first
              - name: "struct-member-1"
                location: memory
                offset:
                  ~sum:
                    - .offset: "struct-member-0"
                    - .length: "struct-member-0"
                length: ~wordsize

  - # example \`string storage\` allocation
    define:
      "string-storage-contract-variable-slot": 0
    in:
      group:
        # for short strings, the length is stored as 2n in the last byte of slot
        - name: "length-flag"
          location: storage
          slot: "string-storage-contract-variable-slot"
          offset:
            ~difference: [~wordsize, 1]
          length: 1

        # define the region representing the string data itself conditionally
        # based on odd or even length data
        - if:
            ~remainder:
              - ~sum:
                  - ~read: "length-flag"
                  - 1
              - 2

          # short string case (flag is even)
          then:
            define:
              "string-length":
                ~quotient: [{ ~read: "length-flag" }, 2]
            in:
              name: "string"
              location: storage
              slot: "string-storage-contract-variable-slot"
              offset: 0
              length: "string-length"

          # long string case (flag is odd)
          else:
            group:
              # long strings may use full word to describe length as 2n+1
              - name: "long-string-length-data"
                location: storage
                slot: "string-storage-contract-variable-slot"
                offset: 0
                length: ~wordsize

              - define:
                  "string-length":
                    ~quotient:
                      - ~difference:
                          - ~read: "long-string-length-data"
                          - 1
                      - 2

                  "start-slot":
                    ~keccak256:
                      - ~wordsized: "string-storage-contract-variable-slot"

                  "total-slots":
                    # account for both zero and nonzero slot remainders by adding
                    # ~wordsize-1 to the length before dividing
                    ~quotient:
                      - ~sum: ["string-length", { ~difference: [~wordsize, 1] }]
                      - ~wordsize
                in:
                  list:
                    count: "total-slots"
                    each: "i"
                    is:
                      define:
                        "current-slot":
                          ~sum: ["start-slot", "i"]
                        "previous-length":
                          ~product: ["i", ~wordsize]
                      in:
                        # conditional based on whether this is the last slot:
                        # is the string length longer than the previous length
                        # plus this whole slot?
                        if:
                          ~difference:
                            - "string-length"
                            - ~sum: ["previous-length", "~wordsize"]
                        then:
                          # include the whole slot
                          name: "string"
                          location: storage
                          slot: "current-slot"
                        else:
                          # include only what's left in the string
                          name: "string"
                          location: storage
                          slot: "current-slot"
                          offset: 0
                          length:
                            ~difference: ["string-length", "previous-length"]

  - # example \`string storage\` (long form) as a single multi-slot region
    #
    # this is the same long-string body as the previous example, collapsed
    # to one region. Because a segment's length may run across slots (see
    # the segment addressing scheme), the whole string is a single region
    # beginning at "start-slot"; no per-slot list or last-slot trim is
    # needed, and the compiler emits far less. The per-slot list form above
    # remains useful when a consumer wants a distinct region per slot.
    define:
      "string-storage-slot": 0
    in:
      group:
        - name: "long-string-length-data"
          location: storage
          slot: "string-storage-slot"
          offset: 0
          length: ~wordsize

        - define:
            "string-length":
              ~quotient:
                - ~difference:
                    - ~read: "long-string-length-data"
                    - 1
                - 2

            "start-slot":
              ~keccak256:
                - ~wordsized: "string-storage-slot"
          in:
            name: "string"
            location: storage
            slot: "start-slot"
            offset: 0
            length: "string-length"
`,"schema:ethdebug/format/program/context/code":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/code"

title: ethdebug/format/program/context/code
description: |
  Information about the source code range corresponding to this point in
  machine execution.

type: object
properties:
  code:
    $ref: "schema:ethdebug/format/materials/source-range"
required:
  - code

examples:
  - code:
      source:
        id: 5
      range:
        offset: 68
        length: 16
`,"schema:ethdebug/format/program/context/frame":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/frame"

title: ethdebug/format/program/context/frame
description: |
  A context may specify a \`"frame"\` property to indicate that its facts apply
  only to one of several possible compilation frames, e.g. for compilers with
  distinct frontend/backends to specify debugging data for the IR separately
  from the debugging data for the source language.
type: object
properties:
  frame:
    title: Relevant compilation frame
    type: string
required:
  - frame

examples:
  - frame: "ir"
  - frame: "source"
`,"schema:ethdebug/format/program/context/function/invoke":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/function/invoke"

title: ethdebug/format/program/context/function/invoke
description: |
  This context indicates that the marked instruction is
  associated with a function invocation. The invocation is one
  of three kinds: an internal call via JUMP, an external message
  call (CALL / DELEGATECALL / STATICCALL), or a contract
  creation (CREATE / CREATE2).

  Extends the function identity schema with kind-specific fields
  such as call targets, gas, value, and input data.

  Per the **ethdebug/format/program/instruction** schema, an
  instruction's context holds following that instruction's
  execution: the context's semantic facts (e.g., "a function was
  invoked") hold from that point forward, and pointers within
  the context resolve against the machine state after the
  instruction has executed. The operand pointers of an external
  call or contract creation are the one exception, described
  below.

  For internal calls, this context is typically placed on the
  callee's entry JUMPDEST. The caller's JUMP has consumed its
  destination operand by then, and JUMPDEST leaves the stack
  unchanged, so after it executes the remaining stack (return
  address, arguments) is stable and directly addressable.

  For external calls and contract creations, this context marks
  the CALL/DELEGATECALL/STATICCALL/CREATE/CREATE2 instruction
  itself: the invocation occurs when that instruction executes.
  The pointer fields of a \`message\` or \`create\` invocation
  (\`target\`, \`gas\`, \`value\`, \`input\`, \`salt\`) describe the
  operands of the marked instruction, which the instruction
  consumes. These pointers therefore resolve against the machine
  state immediately **before** the marked instruction executes.

type: object
properties:
  invoke:
    type: object
    title: Function invocation
    description: |
      Describes the function invocation associated with this
      context. Must indicate exactly one invocation kind: \`jump\`
      for an internal call, \`message\` for an external call, or
      \`create\` for a contract creation.

    $ref: "schema:ethdebug/format/program/context/function"

    properties:
      activation:
        type: string
        title: Activation identifier
        description: |
          Correlation identifier pairing this invocation with its
          matching return or revert. The invoke that opens an
          activation and the return or revert that closes it carry
          the same value; distinct activations carry distinct
          values, unique within the program. Lets a debugger pair a
          call with its return independent of trace order. Optional.

    allOf:
      - oneOf:
          - required: [jump]
          - required: [message]
          - required: [create]
      - if:
          required: [jump]
        then:
          $ref: "#/$defs/InternalCall"
      - if:
          required: [message]
        then:
          $ref: "#/$defs/ExternalCall"
      - if:
          required: [create]
        then:
          $ref: "#/$defs/ContractCreation"

    unevaluatedProperties: false

required:
  - invoke

$defs:
  InternalCall:
    title: Internal call
    description: |
      An internal function call within the same contract. This
      context is typically placed on the callee's entry JUMPDEST;
      the caller's JUMP has already consumed the destination from
      the stack, so pointer slot values reflect the post-JUMP
      layout.
    type: object
    properties:
      jump:
        description: |
          Indicates this is an internal function call (JUMP/JUMPI).
        const: true

      target:
        type: object
        title: Invocation target
        description: |
          Pointer to the target of the invocation. For internal
          calls, this typically points to a code location.
          Optional: may be omitted when there is no meaningful
          target pointer to record, e.g., at the first
          instruction of an inlined function body where the
          inlining pass has elided the JUMP that would normally
          carry this pointer. The callee identity
          (\`identifier\`, \`declaration\`, \`type\`) is still
          meaningful in this case.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      arguments:
        type: object
        title: Function arguments
        description: |
          Pointer to the arguments for an internal function call.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

    required: [jump]

  ExternalCall:
    title: External call
    description: |
      An external message call to another contract via CALL,
      DELEGATECALL, or STATICCALL. Set \`delegate\` or \`static\` to
      \`true\` to indicate the call variant; if neither is present
      the call is a regular CALL.

      This context marks the call instruction itself. The \`target\`,
      \`gas\`, \`value\`, and \`input\` pointers describe that
      instruction's operands, so they resolve against the machine
      state immediately **before** it executes.
    type: object
    properties:
      message:
        description: |
          Indicates this is an external message call (CALL,
          DELEGATECALL, or STATICCALL).
        const: true

      target:
        type: object
        title: Invocation target
        description: |
          Pointer to the target of the invocation. For external
          calls, this points to the address and/or selector
          being called.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      gas:
        type: object
        title: Gas allocation
        description: |
          Pointer to the gas allocated for the external call.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      value:
        type: object
        title: ETH value
        description: |
          Pointer to the amount of ETH being sent with the call.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      input:
        type: object
        title: Call input data
        description: |
          Pointer to the input data for the external call.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      delegate:
        description: |
          Indicates this external call is a DELEGATECALL.
        const: true

      static:
        description: |
          Indicates this external call is a STATICCALL.
        const: true

    not:
      description: Only one of \`delegate\` and \`static\` can be set at a time.
      required: [delegate, static]

    required: [message, target]

  ContractCreation:
    title: Contract creation
    description: |
      A contract creation via CREATE or CREATE2. The presence
      of \`salt\` distinguishes CREATE2 from CREATE.

      This context marks the CREATE or CREATE2 instruction itself.
      The \`value\`, \`salt\`, and \`input\` pointers describe that
      instruction's operands, so they resolve against the machine
      state immediately **before** it executes.
    type: object
    properties:
      create:
        description: |
          Indicates this is a contract creation operation
          (CREATE or CREATE2).
        const: true

      value:
        type: object
        title: ETH value
        description: |
          Pointer to the amount of ETH being sent with the
          creation.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      salt:
        type: object
        title: CREATE2 salt
        description: |
          Pointer to the salt value for CREATE2. Its presence
          implies this is a CREATE2 operation.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      input:
        type: object
        title: Creation bytecode
        description: |
          Pointer to the creation bytecode for the new contract.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

    required: [create]

examples:
  # -----------------------------------------------------------
  # Internal call: transfer(address, uint256)
  # -----------------------------------------------------------
  # This context would mark the JUMPDEST at the entry of the
  # \`transfer\` function. The caller's JUMP has consumed the
  # destination from the stack, leaving (top first):
  #
  #   slot 0: return label
  #   slot 1: first argument  (\`to\`)
  #   slot 2: second argument (\`amount\`)
  #
  # The \`target\` pointer identifies the function's entry point
  # in the bytecode; \`arguments\` uses a group to name each
  # argument's stack position.
  - invoke:
      identifier: "transfer"
      declaration:
        source:
          id: 0
        range:
          offset: 128
          length: 95
      type:
        id: 7
      jump: true
      target:
        pointer:
          location: code
          offset: "0x100"
          length: 1
      arguments:
        pointer:
          group:
            - name: "to"
              location: stack
              slot: 1
            - name: "amount"
              location: stack
              slot: 2
      # The matching return context carries the same \`activation\`
      # value, pairing this call with its return.
      activation: "transfer#0"

  # -----------------------------------------------------------
  # Inlined internal call: no target pointer
  # -----------------------------------------------------------
  # When the compiler inlines a function, the JUMP that would
  # normally carry the invoke context has been elided \u2014 there
  # is no physical call instruction and no code target to
  # point at. The invoke context still records the callee's
  # identity so the debugger can maintain a source-level call
  # stack, and a \`transform: ["inline"]\` context annotates the
  # inlining \u2014 composed flat alongside the invoke on the same
  # context object (the two carry disjoint keys).
  - invoke:
      identifier: "transfer"
      declaration:
        source:
          id: 0
        range:
          offset: 128
          length: 95
      jump: true
      # Correlation id: the matching inlined \`return\` carries the
      # same value, so the two pair even if \`transfer\` is inlined
      # at several sites.
      activation: "transfer#0"

  # -----------------------------------------------------------
  # External CALL: token.balanceOf(account)
  # -----------------------------------------------------------
  # This context marks the CALL instruction. Its pointers
  # describe the operands of the CALL, so they resolve against
  # the state before the CALL executes (CALL consumes all of
  # its stack operands):
  #
  #   slot 0: gas to forward
  #   slot 1: target contract address
  #   slot 2: value (0 \u2014 balanceOf is non-payable)
  #
  # The ABI-encoded calldata has already been written to
  # memory at 0x80:
  #
  #   0x80..0x83: function selector     (4 bytes)
  #   0x84..0xa3: abi-encoded \`account\` (32 bytes)
  - invoke:
      identifier: "balanceOf"
      message: true
      target:
        pointer:
          location: stack
          slot: 1
      gas:
        pointer:
          location: stack
          slot: 0
      value:
        pointer:
          location: stack
          slot: 2
      input:
        pointer:
          group:
            - name: "selector"
              location: memory
              offset: "0x80"
              length: 4
            - name: "arguments"
              location: memory
              offset: "0x84"
              length: "0x20"

  # -----------------------------------------------------------
  # DELEGATECALL: proxy forwarding calldata
  # -----------------------------------------------------------
  # This context marks a DELEGATECALL instruction in a proxy
  # contract. The call executes the implementation's code
  # within the proxy's storage context. The pointers describe
  # the operands of the DELEGATECALL, so they resolve against
  # the state before it executes (DELEGATECALL consumes all of
  # its stack operands):
  #
  #   slot 0: gas
  #   slot 1: implementation address
  #
  # The original calldata has been copied into memory:
  #
  #   0x80..0xe3: forwarded calldata (100 bytes)
  - invoke:
      message: true
      delegate: true
      target:
        pointer:
          location: stack
          slot: 1
      gas:
        pointer:
          location: stack
          slot: 0
      input:
        pointer:
          location: memory
          offset: "0x80"
          length: "0x64"

  # -----------------------------------------------------------
  # CREATE2: deploying a child contract
  # -----------------------------------------------------------
  # This context marks the CREATE2 instruction. The pointers
  # describe the operands of the CREATE2, so they resolve
  # against the state before it executes (CREATE2 consumes all
  # of its stack operands). The EVM stack layout for
  # CREATE2 (top first):
  #
  #   slot 0: value  (ETH to send to the new contract)
  #   slot 1: offset (memory offset of init code)
  #   slot 2: length (byte length of init code)
  #   slot 3: salt   (for deterministic address derivation)
  #
  # The init code has been placed in memory:
  #
  #   0x80..0x027f: creation bytecode (512 bytes)
  - invoke:
      create: true
      value:
        pointer:
          location: stack
          slot: 0
      salt:
        pointer:
          location: stack
          slot: 3
      input:
        pointer:
          location: memory
          offset: "0x80"
          length: "0x200"
`,"schema:ethdebug/format/program/context/function/return":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/function/return"

title: ethdebug/format/program/context/function/return
description: |
  This context indicates that the marked instruction is
  associated with a successful function return. Extends the
  function identity schema with an optional pointer to the
  return data and, for external calls, the success status.

  All fields are optional. A bare \`return: {}\` is permitted
  when the compiler knows a return occurred but has no further
  detail\u2014for example, at a tail-call-optimized back-edge where
  the intermediate return value is not materialized, or for a
  void function with no return value.

type: object
properties:
  return:
    type: object

    $ref: "schema:ethdebug/format/program/context/function"

    properties:
      data:
        type: object
        title: Return data
        description: |
          Pointer to the data being returned from the function.
          Optional: may be omitted when no return value is
          observable at this instruction (e.g., void functions,
          tail-call-optimized returns where the intermediate
          value is not materialized).
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      success:
        type: object
        title: Call success status
        description: |
          Pointer to the success status of an external call.
          Typically points to a boolean value on the stack.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      activation:
        type: string
        title: Activation identifier
        description: |
          Correlation identifier for the activation this return
          ends. Matches the \`activation\` on the \`invoke\` that
          opened the same activation; distinct activations carry
          distinct values, unique within the program. Lets a
          debugger pair a return with its invocation independent
          of trace order. Optional.

    unevaluatedProperties: false

required:
  - return

examples:
  # -----------------------------------------------------------
  # Internal return: transfer(address, uint256) returns (bool)
  # -----------------------------------------------------------
  # This context would mark the JUMP instruction that returns
  # control to the caller. The function has left its return
  # value on the stack:
  #
  #   slot 0: return value (\`bool success\`)
  - return:
      identifier: "transfer"
      declaration:
        source:
          id: 0
        range:
          offset: 128
          length: 95
      data:
        pointer:
          location: stack
          slot: 0
      # Same \`activation\` value as the opening \`invoke\`, pairing
      # this return with its call.
      activation: "transfer#0"

  # -----------------------------------------------------------
  # External call return: processing result of a CALL
  # -----------------------------------------------------------
  # This context would mark an instruction on the path that
  # follows a CALL that completed successfully. The EVM places
  # a success flag on the stack, and the callee's return data
  # is accessible via the returndata buffer. After the marked
  # instruction executes:
  #
  #   stack slot 0: success flag (1 = success)
  #   returndata 0x00..0x1f: ABI-encoded return value (32 bytes)
  - return:
      data:
        pointer:
          location: returndata
          offset: 0
          length: "0x20"
      success:
        pointer:
          location: stack
          slot: 0

  # -----------------------------------------------------------
  # Minimal return: only the data pointer
  # -----------------------------------------------------------
  # When the compiler cannot attribute the return to a named
  # function, the context may contain only the return data.
  # Here, a single stack value is being returned.
  #
  #   slot 0: return value
  - return:
      data:
        pointer:
          location: stack
          slot: 0

  # -----------------------------------------------------------
  # Return without observable data: TCO back-edge
  # -----------------------------------------------------------
  # At a tail-call-optimized back-edge JUMP, the intermediate
  # return value is not materialized on the stack \u2014 it would
  # have been the argument to the next iteration, which the
  # compiler has already folded into the new call's setup.
  # A return semantically happens (the outer activation's
  # iteration N is returning), but there is no pointer to
  # record for \`data\`.
  - return:
      identifier: "fact"
      declaration:
        source:
          id: 0
        range:
          offset: 64
          length: 120
`,"schema:ethdebug/format/program/context/function/revert":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/function/revert"

title: ethdebug/format/program/context/function/revert
description: |
  This context indicates that the marked instruction is
  associated with a function revert. Extends the function
  identity schema with an optional pointer to revert reason
  data and/or a numeric panic code.

type: object
properties:
  revert:
    type: object

    $ref: "schema:ethdebug/format/program/context/function"

    properties:
      reason:
        type: object
        title: Revert reason
        description: |
          Pointer to the revert reason data. This typically contains
          an ABI-encoded error message or custom error data.
        properties:
          pointer:
            $ref: "schema:ethdebug/format/pointer"
        required:
          - pointer
        additionalProperties: false

      panic:
        type: integer
        title: Panic code
        description: |
          Numeric panic code for built-in assertion failures.
          Languages may define their own panic code conventions
          (e.g., Solidity uses codes like 0x11 for arithmetic
          overflow).

      activation:
        type: string
        title: Activation identifier
        description: |
          Correlation identifier for the activation this revert
          ends. Matches the \`activation\` on the \`invoke\` that
          opened the same activation; distinct activations carry
          distinct values, unique within the program. Lets a
          debugger pair an abnormal exit with its invocation
          independent of trace order. Optional.

    unevaluatedProperties: false

required:
  - revert

examples:
  # -----------------------------------------------------------
  # Revert with reason: require() failure in transfer
  # -----------------------------------------------------------
  # This context would mark the REVERT instruction after a
  # failed require(). The compiler has written the ABI-encoded
  # Error(string) revert reason into memory:
  #
  #   0x80..0xe3: ABI-encoded Error(string) (100 bytes)
  #               selector 0x08c379a0 + offset + length + data
  - revert:
      identifier: "transfer"
      reason:
        pointer:
          location: memory
          offset: "0x80"
          length: "0x64"

  # -----------------------------------------------------------
  # Panic: arithmetic overflow (code 0x11)
  # -----------------------------------------------------------
  # A built-in safety check detected an arithmetic overflow.
  # The panic code alone identifies the failure; no pointer to
  # revert data is needed since the compiler inserts the check
  # itself.
  - revert:
      panic: 17

  # -----------------------------------------------------------
  # External call revert: processing a failed CALL
  # -----------------------------------------------------------
  # This context would mark an instruction after a CALL that
  # reverted. The callee's revert reason is accessible via the
  # returndata buffer:
  #
  #   returndata 0x00..0x63: ABI-encoded revert reason
  - revert:
      reason:
        pointer:
          location: returndata
          offset: 0
          length: "0x64"
`,"schema:ethdebug/format/program/context/function":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/function"

title: ethdebug/format/program/context/function
description: |
  Properties for identifying a source-language function. Function
  context schemas (invoke, return, revert) extend this schema so
  that each context can optionally indicate which function it
  pertains to.

  All properties are optional so that compilers may provide as
  much or as little detail as is available.

type: object
properties:
  identifier:
    type: string
    minLength: 1
    description: |
      The function's name in the source language.

  declaration:
    description: |
      Source range where the function is declared.
    $ref: "schema:ethdebug/format/materials/source-range"

  type:
    description: |
      The function's type, specified either as a full
      ethdebug/format/type representation or a type reference.
    $ref: "schema:ethdebug/format/type/specifier"

examples:
  # All three identity fields provided: the compiler knows the
  # function name, where it was declared, and its type.
  - identifier: "transfer"
    declaration:
      source:
        id: 0
      range:
        offset: 128
        length: 95
    type:
      id: 7

  # Only the function name is known.
  - identifier: "balanceOf"

  # No identity information. The compiler knows that a function
  # context applies but cannot attribute it to a specific
  # function (e.g., an indirect call through a function pointer).
  - {}
`,"schema:ethdebug/format/program/context/gather":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/gather"

title: ethdebug/format/program/context/gather
description: |
  A context specifying the \`"gather"\` property with a list of contexts
  indicates that all specified contexts apply simultaneously.

type: object
properties:
  gather:
    title: Contexts to gather
    type: array
    items:
      $ref: "schema:ethdebug/format/program/context"
    minItems: 2
required:
  - gather

examples:
  - gather:
      - frame: "ir"
        code:
          source:
            id: 0
          range:
            offset: 8
            length: 11
      - frame: "source"
        code:
          source:
            id: 3
          range:
            offset: 113
            length: 19
  - gather:
      - variables:
          - identifier: x
            declaration:
              source:
                id: 5
              range:
                offset: 10
                length: 56
            type:
              kind: string
      - variables:
          - identifier: x
            declaration:
              source:
                id: 5
              range:
                offset: 10
                length: 56
            pointer:
              location: storage
              slot: 0
`,"schema:ethdebug/format/program/context/name":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/name"

title: ethdebug/format/program/context/name
description: |
  An optional identifier attached to a context.

  Today a \`name\` acts as a label. It is most useful inside a
  \`pick\`, whose alternatives are listed inline: a name distinguishes
  those alternatives from one another when several contexts may apply
  at a point in execution.

  Names are opaque strings; the format imposes no structure on them.
  A name is meant to be unique within a program so it can identify a
  context, but the format does **not** yet define any way to
  reference a context by its name \u2014 so a declared name is currently
  inert, a label only.

  It is groundwork: establishing the identifier now lets a future
  name-based \`pick\` selection reference an alternative by its name
  instead of listing it inline. Compilers **should** choose names
  that are meaningful to debugger users.

type: object
properties:
  name:
    type: string
    minLength: 1
required:
  - name

examples:
  # example: distinguishing a \`pick\` alternative
  - name: "storage-layout-v2"
  # example: naming a generic instantiation
  - name: "Array<T=bytes32>"
`,"schema:ethdebug/format/program/context/pick":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/pick"

title: ethdebug/format/program/context/pick
description: |
  A program context that specifies the \`"pick"\` property indicates that
  one of several possible contexts are known to be true, possibly requiring
  additional information to disambiguate.

type: object
properties:
  pick:
    title: Contexts to pick from
    type: array
    items:
      $ref: "schema:ethdebug/format/program/context"
    minItems: 2
required:
  - pick

examples:
  - pick:
      - code:
          source:
            id: 5
          range:
            offset: 68
            length: 16
      - code:
          source:
            id: 5
          range:
            offset: 132
            length: 16

  - # example: named alternatives for disambiguation
    pick:
      - name: "inlined-call"
        code:
          source:
            id: 5
          range:
            offset: 68
            length: 16
      - name: "original-site"
        code:
          source:
            id: 5
          range:
            offset: 132
            length: 16
`,"schema:ethdebug/format/program/context/remark":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/remark"

title: ethdebug/format/program/context/remark
description: |
  Human-readable information about the instruction. This field is intended
  primarily not for compilers to use directly, but rather for humans
  (directly or indirectly) to use as an annotation field.

type: object
properties:
  remark:
    type: string

required:
  - remark

examples:
  - remark: "jump to end if zero"
`,"schema:ethdebug/format/program/context/transform":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/transform"

title: ethdebug/format/program/context/transform
description: |
  Annotates an instruction with compiler transformations that
  produced it. The value is a list of short identifiers naming
  each transformation; the list may repeat an identifier when
  the same transformation has been applied more than once (e.g.,
  \`["inline", "inline"]\` for doubly-inlined code).

  A transform context is *additional* annotation \u2014 it does not
  replace semantic contexts. When the compiler inlines a
  function, the invoke/return contexts for the logical call
  should still be emitted at the call boundary so the debugger's
  source-level call stack remains coherent. The transform
  context tells debuggers **how** the call was realized.

  Combine a transform with other discriminator keys (\`invoke\`,
  \`return\`, \`code\`, etc.) by placing them side-by-side on the
  same context object \u2014 \`gather\` is only needed when two
  contexts would collide on the same key.

  Consumers that ignore transform contexts still get a sound
  source-level view from the invoke/return contexts alone.
  Consumers that understand transform contexts can offer
  optimization-aware presentations \u2014 e.g., rendering inlined
  code as a collapsible block, or reconciling tail-call-optimized
  back-edges with the logical call stack.

  The identifier set is extensible. The schema defines:

  - \`"inline"\` \u2014 the marked instruction is part of an inlined
    function body. Surrounding invoke/return contexts name the
    inlined callee.
  - \`"tailcall"\` \u2014 the marked instruction is a
    tail-call-optimized back-edge JUMP or continuation, where
    the call was realized as a direct jump (or reuse of the
    caller's frame) rather than a standard call/return sequence.
  - \`"fold"\` \u2014 the marked instruction carries the result of a
    compile-time constant fold. Typically a PUSH of the folded
    value, replacing a compute sequence that appeared in source.
  - \`"coalesce"\` \u2014 the marked instruction is part of a
    read-write merging sequence (e.g., SHL/OR sequences packing
    narrower fields into a wider word) that the user did not
    explicitly write; the compiler introduced it to combine
    adjacent source-level reads or writes.

  Debuggers unfamiliar with a given identifier should preserve
  it as an opaque label.

  Order in the array is not semantically significant \u2014 only the
  multiset of identifiers matters.

type: object
properties:
  transform:
    title: Applied transformations
    description: |
      List of transformation identifiers. Identifiers may
      repeat; order is not semantically significant.
    type: array
    items:
      type: string
      minLength: 1
    minItems: 1

required:
  - transform

examples:
  - transform: ["inline"]
  - transform: ["tailcall"]
  - transform: ["fold"]
  - transform: ["coalesce"]
  - transform: ["inline", "inline"]
  - transform: ["inline", "tailcall"]
  - transform: ["inline", "fold"]
  - transform: ["coalesce", "coalesce"]
`,"schema:ethdebug/format/program/context/variables":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/variables"

title: ethdebug/format/program/context/variables
description: |
  Information about known variables at this context's point in code
  execution, specified as an array whose items each correspond to a unique
  variable.

  Items in this array **should not** have duplicate non-empty \`identifier\`
  values except where high-level language semantics require it. Where
  possible, use other mechanisms provided by this format to indicate that
  an identifier's corresponding variable is ambiguous.

type: object
properties:
  variables:
    type: array
    items:
      $ref: "#/$defs/Variable"
    minItems: 1
required:
  - variables

examples:
  - variables:
      - identifier: x
        declaration:
          source:
            id: 5
          range:
            offset: 10
            length: 56
        type:
          kind: string
        pointer:
          location: storage
          slot: 0

$defs:
  Variable:
    title: Variable
    description: |
      The information known about a variable at a particular point in the code
      execution.

    type: object
    properties:
      identifier:
        type: string
        minLength: 1

      declaration:
        description: |
          Source range corresponding to where the variable was declared.
        $ref: "schema:ethdebug/format/materials/source-range"

      type:
        description: |
          The variable's static type, if it exists. This **must** be
          specified either as a full **ethdebug/format/type**
          representation, or an \`{ "id": "..." }\` type reference.
        $ref: "schema:ethdebug/format/type/specifier"

      pointer:
        description: |
          Allocation information for the variable, if it exists.
        $ref: "schema:ethdebug/format/pointer"

    minProperties: 1
    unevaluatedProperties: false

    examples:
      - identifier: x
        declaration:
          source:
            id: 5
          range:
            offset: 10
            length: 56
`,"schema:ethdebug/format/program/context":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context"

title: ethdebug/format/program/context
description: |
  An **ethdebug/format/program/context** object represents compile-time
  information about the high-level runtime execution state at a specific point
  in a program's bytecode.

  This schema provides a formal specification for this format's model of what
  information can be known at compile-time about the high-level runtime. This
  includes data such as a particular machine instruction's source mapping or
  what variables exist in runtime state following some instruction.

  The context object supports dynamic context combination and selection through
  the use of \`gather\`, and \`pick\` properties. This allows for flexible
  composition and extraction of context information.

  Contexts serve as a bridge between low-level EVM execution and high-level
  language constructs. Debuggers can use these compile-time guarantees to
  maintain a coherent view of the high-level language runtime throughout
  program execution. This enables debugging tools to map execution points to
  source code, reconstruct variable states, provide meaningful stack traces,
  and offer insights into control flow and data structures.

type: object

allOf:
  - if:
      required: ["name"]
    then:
      description: |
        A label for distinguishing this context from others.
      $ref: "schema:ethdebug/format/program/context/name"
  - if:
      required: ["code"]
    then:
      description: |
        The context's corresponding source code range.
      $ref: "schema:ethdebug/format/program/context/code"
  - if:
      required: ["variables"]
    then:
      description: |
        Variable definitions, types, allocations known to exist in the context.
      $ref: "schema:ethdebug/format/program/context/variables"
  - if:
      required: ["remark"]
    then:
      description: |
        Human-readable context annotation. Not intended for compiler use.
      $ref: "schema:ethdebug/format/program/context/remark"
  - if:
      required: ["pick"]
    then:
      description: |
        Alternation between several possible contexts.
      $ref: "schema:ethdebug/format/program/context/pick"
  - if:
      required: ["gather"]
    then:
      description: |
        Collection of multiple known, separate contexts.
      $ref: "schema:ethdebug/format/program/context/gather"
  - if:
      required: ["frame"]
    then:
      description: |
        For use by compilers with multiple pipeline outputs (e.g., use of an
        intermediary representation) to associate a
        context with a particular compiler step.
      $ref: "schema:ethdebug/format/program/context/frame"
  - if:
      required: ["invoke"]
    then:
      description: |
        Indicates association with a function invocation (internal call,
        external message call, or contract creation).
      $ref: "schema:ethdebug/format/program/context/function/invoke"
  - if:
      required: ["return"]
    then:
      description: |
        Indicates association with a successful function return.
      $ref: "schema:ethdebug/format/program/context/function/return"
  - if:
      required: ["revert"]
    then:
      description: |
        Indicates association with a function revert.
      $ref: "schema:ethdebug/format/program/context/function/revert"
  - if:
      required: ["transform"]
    then:
      description: |
        Compiler transformations applied to produce this instruction
        (e.g., inlining, tail-call optimization). Additional
        annotation \u2014 does not replace semantic contexts.
      $ref: "schema:ethdebug/format/program/context/transform"

unevaluatedProperties: false

examples:
  - variables:
      - identifier: x
        declaration:
          source:
            id: 5
          range:
            offset: 10
            length: 56
        type:
          kind: string
        pointer:
          location: storage
          slot: 0
    code:
      source:
        id: 5
      range:
        offset: 68
        length: 16
`,"schema:ethdebug/format/program/instruction":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/instruction"

title: ethdebug/format/program/instruction
description: |
  A schema for representing the information pertaining to a particular
  instruction in machine code.

type: object

properties:
  offset:
    title: Instruction byte offset
    description: |
      The byte offset where the instruction begins within the bytecode.

      For legacy contract bytecode (non-EOF), this value is equivalent to the
      instruction's program counter. For EOF bytecode, this value **must** be
      the offset from the start of the container, not the start of a particular
      code section within that container.
    $ref: "schema:ethdebug/format/data/value"

  operation:
    title: Machine operation information
    type: object
    properties:
      mnemonic:
        description: The mnemonic operation code (PUSH1, e.g.)
        type: string

      arguments:
        description: The immediate arguments to the operation, if relevant.
        type: array
        minItems: 1
        items:
          description: |
            An immediate value specified as argument to the opcode
          $ref: "schema:ethdebug/format/data/value"

    required:
      - mnemonic

  context:
    description: |
      The context that holds **following** the execution of this
      instruction. Both its semantic facts (source location, variables in
      scope, function invocation, etc.) and any pointers it contains resolve
      against the machine state **after** the instruction has executed
      (its postcondition). The one exception is the operand pointers of
      an external call or contract creation in
      **ethdebug/format/program/context/function/invoke**: they describe
      what the marked instruction consumes, so they resolve against the
      state immediately before it executes.

      Instruction contexts form a chain. The program-level \`context\` is the
      base case: the precondition that holds before the first instruction
      executes. Each instruction's context is then the postcondition of that
      instruction, which is in turn the precondition of the next. A debugger
      paused at the trace step about to execute instruction *i* therefore
      reads the context of instruction *i \u2212 1* \u2014 or, before the first
      instruction, the program-level \`context\`. Equivalently, prepending
      the program-level \`context\` to the sequence of instruction contexts
      yields a single sequence indexed by trace position, with no special
      case: the context in effect when about to execute the instruction at
      position *i* is element *i* of that sequence.

      This field is **optional**. Omitting it is equivalent to specifying the
      empty context value (\`{}\`).
    $ref: "schema:ethdebug/format/program/context"
    default: {}

required:
  - offset

unevaluatedProperties: false

examples:
  - offset: 0
    operation:
      mnemonic: "PUSH1"
      arguments: ["0x60"]
    context:
      code:
        source:
          id: 5
        range:
          offset: 10
          length: 30
`,"schema:ethdebug/format/program":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program"

title: ethdebug/format/program
description: |
  Debugging information about a particular bytecode in a compilation.

type: object

properties:
  ethdebug:
    title: Stamp
    description: |
      Names this schema and the specification version. A program
      emitted outside an info document should carry this field. A
      program inside an info document (in \`programs\`) should not; the
      stamp of the info document covers it.
    allOf:
      - $ref: "schema:ethdebug/format/data/stamp"
      # note: whitespace chars are \\255 (nbsp)
      - title: '{\xA0"schema":\xA0"ethdebug/format/program"\xA0}'
        properties:
          schema:
            const: "ethdebug/format/program"

  compilation:
    title: Compilation reference by ID
    description: |
      A reference to the compilation as an \`{ "id": ... }\` object.
    $ref: "schema:ethdebug/format/materials/reference"

  contract:
    type: object
    properties:
      name:
        type: string

      definition:
        $ref: "schema:ethdebug/format/materials/source-range"
    required:
      - definition

  environment:
    title: Bytecode execution environment
    description: |
      Whether this bytecode is for contract creation or runtime calls.
    type: string
    enum:
      - call
      - create

  context:
    description: |
      The context that holds prior to the execution of the first
      instruction in the bytecode. This is the base case of the context
      chain \u2014 the precondition to the first instruction \u2014 from which each
      instruction's own \`context\` follows as a postcondition (see
      **ethdebug/format/program/instruction**).

      This field is **optional**. Omitting it is equivalent to specifying the
      empty context value (\`{}\`).
    $ref: "schema:ethdebug/format/program/context"
    default: {}

  instructions:
    type: array
    description: |
      The full array of instructions for the bytecode.
    items:
      $ref: "schema:ethdebug/format/program/instruction"

required:
  - contract
  - environment
  - instructions

unevaluatedProperties: false

examples:
  - # Incrementing a storage counter
    #
    # This example represents the call bytecode for the following pseudo-code:
    # \`\`\`
    # contract Incrementer;
    #
    # storage {
    #   [0] storedValue: uint256;
    # };
    #
    # code {
    #   let localValue = storedValue;
    #   storedValue += 1;
    # };
    # \`\`\`
    ethdebug:
      schema: "ethdebug/format/program"
      version: "0.1.0-draft.1"
    contract:
      name: "Incrementer"
      definition:
        source:
          id: 0
    environment: call
    context:
      variables:
        - &stored-value
          identifier: storedValue
          type:
            kind: uint
            bits: 256
          pointer:
            location: storage
            slot: 0
    instructions:
      - offset: 0
        operation:
          mnemonic: PUSH0
        context:
          variables:
            - *stored-value
      - offset: 1
        operation:
          mnemonic: SLOAD
        context:
          variables:
            - *stored-value
            - &local-value
              identifier: localValue
              type:
                kind: uint
                bits: 256
              pointer:
                location: stack
                slot: 0
      - offset: 2
        operation:
          mnemonic: PUSH1
          arguments: ["0x01"]
        context:
          variables:
            - *stored-value
            - <<: *local-value
              pointer:
                location: stack
                slot: 1

      - offset: 4
        operation:
          mnemonic: ADD
        # ADD consumes localValue, leaving storedValue + 1 on the stack,
        # so localValue is no longer observable from this point on.
        context:
          variables:
            - *stored-value
      - offset: 5
        operation:
          mnemonic: PUSH0
        context:
          variables:
            - *stored-value

      - offset: 6
        operation:
          mnemonic: SSTORE
        context:
          variables:
            - *stored-value
`,"schema:ethdebug/format/type/base":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/base"

title: ethdebug/format/type/base
description: Defines the minimally necessary schema for a data type.
  Types belong to a particular \`class\` (\`"elementary"\` or \`"complex"\`),
  and are further identified by a particular \`kind\`.
type: object
oneOf:
  - $ref: "#/$defs/ElementaryType"
  - $ref: "#/$defs/ComplexType"

$defs:
  ElementaryType:
    title: Base elementary type
    description: Represents an elementary type (one that does not compose other types)
    type: object
    properties:
      class:
        type: string
        const: elementary
      kind:
        type: string
      contains:
        not:
          description: "Elementary types **must not** specify a \`contains\` field
            (to make it easier to discriminate elementary vs. complex)"
    required:
      - kind
    examples:
      - kind: uint
        bits: 256

  ComplexType:
    title: Base complex type
    description:
      Represents a complex type, one that composes other types (e.g., arrays,
      structs, mappings)
    type: object
    properties:
      class:
        type: string
        const: complex
        description: Indicates that this is a complex type
      kind:
        type: string
        description: The specific kind of complex type, e.g., array or struct
      contains:
        title: Complex type \`contains\` field
        description:
          Either a type wrapper, an array of type wrappers, or an object
          mapping to type wrappers.
        oneOf:
          - $ref: "#/$defs/TypeWrapper"
          - $ref: "#/$defs/TypeWrapperArray"
          - $ref: "#/$defs/TypeWrapperObject"

    required:
      - kind
      - contains
    examples:
      - kind: array
        contains:
          type:
            kind: uint
            bits: 256
      - kind: struct
        contains:
          - name: x
            type:
              kind: uint
              bits: 256
          - name: y
            type:
              kind: uint
              bits: 256
      - kind: mapping
        contains:
          key:
            type:
              kind: address
              payable: true
          value:
            type:
              kind: uint
              bits: 256

  TypeWrapper:
    title: '{ "type": ... }'
    description:
      A wrapper around a type. Defines a \`"type"\` field that may include a full
      Type representation or a reference to a known Type by ID. Note that this
      schema permits additional properties on the same object.
    type: object
    properties:
      type:
        oneOf:
          - $ref: "schema:ethdebug/format/type/base"
          - $ref: "schema:ethdebug/format/type/reference"

    required:
      - type

  TypeWrapperArray:
    title: '{ "type": ... }[]'
    description: A list of wrapped types, where the wrapper may add fields
    type: array
    items:
      $ref: "#/$defs/TypeWrapper"

  TypeWrapperObject:
    title: '{ "key": { "type": ... }, ... }'
    description: A key-value mapping of wrapped types, where the wrapper may add fields
    type: object
    additionalProperties:
      $ref: "#/$defs/TypeWrapper"
`,"schema:ethdebug/format/type/complex/alias":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/alias"

title: ethdebug/format/type/complex/alias
description: Schema representing a type alias to another type

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: alias
  contains:
    $ref: "schema:ethdebug/format/type/wrapper"
  definition:
    $ref: "schema:ethdebug/format/type/definition"

required:
  - kind
  - contains

examples:
  - kind: alias
    contains:
      type:
        kind: uint
        bits: 256

  - kind: alias
    contains:
      type:
        kind: array
        contains:
          type:
            class: elementary
            kind: super-uint # unsupported type
            blits: -256
`,"schema:ethdebug/format/type/complex/array":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/array"

title: ethdebug/format/type/complex/array
description: |
  Schema for representing array types, both fixed-size and dynamically
  sized. An array type specifies the element type it contains and,
  optionally, a fixed element count.

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: array
  contains:
    description: |
      The element type contained by this array, specified as an
      **ethdebug/format/type/wrapper**.
    $ref: "schema:ethdebug/format/type/wrapper"
  count:
    description: |
      The fixed number of elements in this array. When omitted, the array
      is dynamically sized.
    $ref: "schema:ethdebug/format/data/value"

required:
  - kind
  - contains

examples:
  # example: a dynamically-sized array of uint256
  - kind: array
    contains:
      type:
        kind: uint
        bits: 256

  # example: a fixed-size array of 10 addresses
  - kind: array
    count: 10
    contains:
      type:
        kind: address

  # example: a nested array with an unknown element type
  - kind: array
    contains:
      type:
        kind: array
        contains:
          type:
            class: elementary
            kind: super-uint # unsupported type
            blits: -256
`,"schema:ethdebug/format/type/complex/function":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/function"

title: ethdebug/format/type/complex/function
description: |
  Schema for representing a function type.

  Type representations must indicate whether they represent a function that is
  called internally (within the semantics of the language) or a function that
  is called externally (via EVM contract call semantics and the Solidity ABI).
  Internal function types require the \`"internal": true\` field; external
  function types require \`"external": true\`.

  Note that external function types may include a representation of the
  contract type that defines or provides this function as an external
  interface.

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: function
  contains:
    type: object
    title: Parameter and return types
    description: |
      Types this function type composes. Function types inherently compose
      two groupings of types (an ordered list of parameter types and typically
      either a return value or return parameters). Function types' \`contains\`
      field is organized as a mapping of \`parameters\` types (a type wrapper for
      a tuple type) and an optional \`returns\` type (either a generic type
      wrapper or a type wrapper for a tuple type).

      This definition applies for both cases (internal and external function
      types). Each of those specific types may expand this \`contains\` field
      schema with other semantic details (such as an external function type
      indicating the contract type from which it is exposed).
    properties:
      parameters:
        $ref: "#/$defs/Parameters"
      returns:
        type: object
        title: Return type (or tuple of types)
        description: |
          To accommodate languages differing in whether functions return single
          values or lists of values, this field may be either a generic type
          wrapper or explicitly defined as a type wrapper around a tuple type.

          Debuggers that implement this schema **should** be aware that
          languages whose functions return sole values might return tuple
          types. Resolving this ambiguity remains outside the scope of the
          schema (but compilers **must** be consistent when representing
          function types in this schema).
        anyOf:
          - $ref: "schema:ethdebug/format/type/wrapper"
          - $ref: "#/$defs/Parameters"
    required:
      - parameters
  definition:
    $ref: "schema:ethdebug/format/type/definition"

required:
  - kind
  - contains

oneOf:
  - type: object
    title: External function type
    properties:
      internal:
        const: false
      external:
        const: true
      contains:
        type: object
        title: Additional contents
        properties:
          contract:
            type: object
            title: Contract type providing external function
            description:
              A wrapper around the contract type that composes this external
              function type.
            allOf:
              - $ref: "schema:ethdebug/format/type/wrapper"
              - type: object
                title: Contract type wrapper
                properties:
                  type:
                    oneOf:
                      - $ref: "schema:ethdebug/format/type/elementary/contract"
                      - $ref: "schema:ethdebug/format/type/reference"
    required:
      - external

  - type: object
    title: Internal function type
    properties:
      internal:
        const: true
      external:
        const: false
    required:
      - internal

examples:
  - kind: function
    internal: true
    definition:
      name: increment
    contains:
      parameters:
        type:
          kind: tuple
          contains:
            - name: value
              type:
                kind: uint
                bits: 256
      returns:
        type:
          kind: uint
          bits: 256
  - kind: function
    external: true
    definition:
      name: withdraw
    contains:
      contract:
        type:
          kind: contract
          payable: true
          interface: true
          definition:
            name: Bank
      parameters:
        type:
          kind: tuple
          contains:
            - name: beneficiary
              type:
                kind: address
                payable: true
            - name: amount
              type:
                kind: ufixed
                bits: 128
                places: 18
      returns:
        type:
          kind: tuple
          contains: []

$defs:
  Parameters:
    type: object
    title: Parameters
    description:
      A type wrapper around a tuple of types. This schema uses a tuple type to
      represent an ordered list of types.
    allOf:
      - $ref: "schema:ethdebug/format/type/wrapper"
      - title: Tuple type wrapper
        type: object
        properties:
          type:
            oneOf:
              - $ref: "schema:ethdebug/format/type/complex/tuple"
              - $ref: "schema:ethdebug/format/type/reference"
`,"schema:ethdebug/format/type/complex/mapping":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/mapping"

title: ethdebug/format/type/complex/mapping
description: Schema for representing mapping types

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: mapping
  contains:
    type: object
    title: Mapping key/value types
    properties:
      key:
        $ref: "schema:ethdebug/format/type/wrapper"
      value:
        $ref: "schema:ethdebug/format/type/wrapper"
    required:
      - key
      - value

required:
  - kind
  - contains

examples:
  - kind: mapping
    contains:
      key:
        type:
          kind: address
      value:
        type:
          kind: uint
          bits: 256
`,"schema:ethdebug/format/type/complex/struct":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/struct"

title: ethdebug/format/type/complex/struct
description: Schema for representing struct types

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: struct
  contains:
    type: array
    items:
      $ref: "#/$defs/MemberField"
  definition:
    $ref: "schema:ethdebug/format/type/definition"

required:
  - kind
  - contains

examples:
  - kind: struct
    contains:
      - name: x
        type:
          kind: uint
          bits: 128
      - name: y
        type:
          kind: uint
          bits: 128

$defs:
  MemberField:
    type: object
    title: MemberField
    description:
      A schema representing a member field inside a struct type. This is an
      **ethdebug/format/type/wrapper** with additional fields.
    allOf:
      - $ref: "schema:ethdebug/format/type/wrapper"
      - title: Additional fields
        description:
          An object with optional \`name\` property for identifying named struct
          member fields. **Note** that this language does not specify that a
          struct must be consistent in its use of naming for all fields or none
        type: object
        properties:
          name:
            type: string
`,"schema:ethdebug/format/type/complex/tuple":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex/tuple"

title: ethdebug/format/type/complex/tuple
description: Schema for representing tuple types

type: object
properties:
  class:
    type: string
    const: complex
  kind:
    type: string
    const: tuple
  contains:
    type: array
    items:
      $ref: "#/$defs/Element"

required:
  - kind
  - contains

examples:
  - # empty tuple type
    kind: tuple
    contains: []

  - kind: tuple
    contains:
      - name: x
        type:
          kind: uint
          bits: 128
      - name: y
        type:
          kind: uint
          bits: 128

$defs:
  Element:
    type: object
    title: Element
    description: An optionally named element type within a tuple. This is an
      **ethdebug/format/type/wrapper** with additional fields.
    allOf:
      - $ref: "schema:ethdebug/format/type/wrapper"
      - title: Additional fields
        type: object
        properties:
          name:
            type: string
            description:
              For tuple types where positional element types are identified
              by name, this field **should** include this information.

              This schema makes no restriction on whether all-or-no elements
              have names, and so this field may be sparse across elements of
              the same tuple.
`,"schema:ethdebug/format/type/complex":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/complex"

title: ethdebug/format/type/complex
description: Canonical representation of a complex type

type: object
properties:
  kind:
    $ref: "#/$defs/Kind"
required:
  - kind

allOf:
  - if:
      properties:
        kind:
          const: alias
    then:
      $ref: "schema:ethdebug/format/type/complex/alias"

  - if:
      properties:
        kind:
          const: tuple
    then:
      $ref: "schema:ethdebug/format/type/complex/tuple"

  - if:
      properties:
        kind:
          const: array
    then:
      $ref: "schema:ethdebug/format/type/complex/array"

  - if:
      properties:
        kind:
          const: mapping
    then:
      $ref: "schema:ethdebug/format/type/complex/mapping"

  - if:
      properties:
        kind:
          const: struct
    then:
      $ref: "schema:ethdebug/format/type/complex/struct"

  - if:
      properties:
        kind:
          const: function
    then:
      $ref: "schema:ethdebug/format/type/complex/function"

$defs:
  Kind:
    title: Known complex kind
    description:
      A schema for the values of \`kind\` reserved for known complex types
      included in ethdebug/format
    type: string
    enum:
      - alias
      - tuple
      - array
      - mapping
      - struct
      - function
`,"schema:ethdebug/format/type/definition":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/definition"

title: ethdebug/format/type/definition
description: |
  Object containing name and location information for a type.

  This schema **must** specify at least one of \`name\` or \`location\`.

type: object
properties:
  name:
    type: string

  location:
    $ref: "schema:ethdebug/format/materials/source-range"

anyOf:
  - title: Required \`name\`
    required: [name]
  - title: Required \`location\`
    required: [location]

examples:
  - name: Ballot
    location:
      source:
        id: 5
      range:
        offset: 10
        length: 56
`,"schema:ethdebug/format/type/elementary/address":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/address"

title: ethdebug/format/type/elementary/address
description: Schema describing the representation of an address type

type: object
properties:
  class:
    const: elementary
  kind:
    const: address
  payable:
    type: boolean
    description: If this field is omitted, this type represents an address whose
      payability is not known.
required:
  - kind
examples:
  - # a type for addresses of unknown payability
    kind: address

  - # a type for payable addresses
    kind: address
    payable: true
`,"schema:ethdebug/format/type/elementary/bool":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/bool"

title: ethdebug/format/type/elementary/bool
description: Schema describing the representation of the boolean type

type: object
properties:
  class:
    const: elementary
  kind:
    const: bool
required:
  - kind
examples:
  - kind: bool
`,"schema:ethdebug/format/type/elementary/bytes":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/bytes"

title: ethdebug/format/type/elementary/bytes
description: Schema describing the representation of a type of bytes string
  (either dynamic or static)

type: object
properties:
  class:
    const: elementary
  kind:
    const: bytes
  size:
    description:
      The number of bytes in the bytes string. If this field is omitted, this
      type is the dynamic bytes string type.
    $ref: "schema:ethdebug/format/data/unsigned"
required:
  - kind
examples:
  - # example static bytes type
    kind: bytes
    size: 32
  - # example dynamic bytes type
    kind: bytes
`,"schema:ethdebug/format/type/elementary/contract":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/contract"

title: ethdebug/format/type/elementary/contract
description: Schema describing the representation of a contract type

type: object
properties:
  class:
    const: elementary
  kind:
    const: contract
  payable:
    type: boolean
    description: If this field is omitted, this type represents an address whose
      payability is not known.
  library:
    type: boolean
  interface:
    type: boolean
  definition:
    $ref: "schema:ethdebug/format/type/definition"

oneOf:
  - title: Normal contract type
    properties:
      library:
        const: false
      interface:
        const: false

  - title: Contract library type
    properties:
      library:
        const: true
        description: Indicates that this is a type representing a library
    required:
      - library

  - title: Contract interface type
    properties:
      interface:
        const: true
        description: Indicates that this is a type representing an interface
    required:
      - interface

required:
  - kind

examples:
  - kind: contract

  - kind: contract
    library: false
    interface: false
    payable: true
`,"schema:ethdebug/format/type/elementary/enum":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/enum"

title: ethdebug/format/type/elementary/enum
description: Schema describing the representation of an enumerated type

type: object
properties:
  class:
    const: elementary
  kind:
    const: enum
  values:
    description:
      The allowed values of an enum. This format makes no restriction on which
      values are allowed here.
    type: array
    items: true
  definition:
    $ref: "schema:ethdebug/format/type/definition"

required:
  - kind
  - values

examples:
  - kind: enum
    values:
      - A
      - B
      - C
`,"schema:ethdebug/format/type/elementary/fixed":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/fixed"

title: ethdebug/format/type/elementary/fixed
description: Schema describing the representation of a signed fixed decimal type

type: object
properties:
  class:
    const: elementary
  kind:
    const: fixed
  bits:
    type: integer
    multipleOf: 8
    minimum: 8
    maximum: 256
  places:
    type: integer
    description:
      How many decimal places, implying that a raw value \`v\` of this type
      should be interpreted as \`v / (10**places)\`
    minimum: 1
    maximum: 80
required:
  - kind
  - bits
  - places
examples:
  - kind: fixed
    bits: 256
    places: 10
`,"schema:ethdebug/format/type/elementary/int":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/int"

title: ethdebug/format/type/elementary/int
description: Schema describing the representation of a signed integer type

type: object
properties:
  class:
    const: elementary
  kind:
    const: int
  bits:
    type: integer
    multipleOf: 8
    minimum: 8
    maximum: 256
required:
  - kind
  - bits
examples:
  - kind: int
    bits: 256
`,"schema:ethdebug/format/type/elementary/string":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/string"

title: ethdebug/format/type/elementary/string
description: Schema describing the representation of a string type

type: object
properties:
  class:
    const: elementary
  kind:
    const: string
  encoding:
    description: |
      The character encoding of the string's bytes at runtime.
    $ref: "schema:ethdebug/format/materials/encoding"
    default: utf-8
required:
  - kind
examples:
  - kind: string
  - kind: string
    encoding: utf-16le
`,"schema:ethdebug/format/type/elementary/ufixed":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/ufixed"

title: ethdebug/format/type/elementary/ufixed
description: Schema describing the representation of an unsigned fixed decimal type

type: object
properties:
  class:
    const: elementary
  kind:
    const: ufixed
  bits:
    type: integer
    multipleOf: 8
    minimum: 8
    maximum: 256
  places:
    type: integer
    description:
      How many decimal places, implying that a raw value \`v\` of this type
      should be interpreted as \`v / (10**places)\`
    minimum: 1
    maximum: 80
required:
  - kind
  - bits
  - places
examples:
  - kind: ufixed
    bits: 256
    places: 10
`,"schema:ethdebug/format/type/elementary/uint":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/uint"

title: ethdebug/format/type/elementary/uint
description: Schema describing the representation of an unsigned integer type

type: object
properties:
  class:
    const: elementary
  kind:
    const: uint
  bits:
    type: integer
    multipleOf: 8
    minimum: 8
    maximum: 256
required:
  - kind
  - bits
examples:
  - kind: uint
    bits: 256
`,"schema:ethdebug/format/type/elementary":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary"

title: ethdebug/format/type/elementary
description: Canonical representation of an elementary type

type: object
properties:
  kind:
    $ref: "#/$defs/Kind"
  contains:
    not:
      description: "Elementary types **must not** specify a \`contains\` field
        (to make it easier to discriminate elementary vs. complex)"
required:
  - kind

allOf:
  - if:
      properties:
        kind:
          const: uint
    then:
      $ref: "schema:ethdebug/format/type/elementary/uint"

  - if:
      properties:
        kind:
          const: int
    then:
      $ref: "schema:ethdebug/format/type/elementary/int"

  - if:
      properties:
        kind:
          const: bool
    then:
      $ref: "schema:ethdebug/format/type/elementary/bool"

  - if:
      properties:
        kind:
          const: bytes
    then:
      $ref: "schema:ethdebug/format/type/elementary/bytes"

  - if:
      properties:
        kind:
          const: string
    then:
      $ref: "schema:ethdebug/format/type/elementary/string"

  - if:
      properties:
        kind:
          const: ufixed
    then:
      $ref: "schema:ethdebug/format/type/elementary/ufixed"

  - if:
      properties:
        kind:
          const: fixed
    then:
      $ref: "schema:ethdebug/format/type/elementary/fixed"
  - if:
      properties:
        kind:
          const: address
    then:
      $ref: "schema:ethdebug/format/type/elementary/address"

  - if:
      properties:
        kind:
          const: contract
    then:
      $ref: "schema:ethdebug/format/type/elementary/contract"

  - if:
      properties:
        kind:
          const: enum
    then:
      $ref: "schema:ethdebug/format/type/elementary/enum"

$defs:
  Kind:
    title: Known elementary kind
    description:
      A schema for the values of \`kind\` reserved for known elementary types
      included in ethdebug/format
    type: string
    enum:
      - uint
      - int
      - bool
      - bytes
      - string
      - ufixed
      - fixed
      - address
      - contract
      - enum
`,"schema:ethdebug/format/type/reference":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/reference"

title: ethdebug/format/type/reference
description: A reference to a known type by ID
type: object
properties:
  id:
    type:
      - string
      - number
additionalProperties: false
required:
  - id
examples:
  - id: 5
`,"schema:ethdebug/format/type/specifier":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/specifier"

title: ethdebug/format/type/specifier
description: |
  A type specifier: either a complete type representation or a
  reference to a known type by ID. This schema discriminates
  between the two forms based on the presence of an \`id\` field.

if:
  required: [id]
then:
  $ref: "schema:ethdebug/format/type/reference"
else:
  $ref: "schema:ethdebug/format/type"

examples:
  - kind: uint
    bits: 256
  - id: 42
`,"schema:ethdebug/format/type/wrapper":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/wrapper"

title: ethdebug/format/type/wrapper
description:
  A wrapper around a type. Defines a \`"type"\` field that may include a full
  Type representation or a reference to a known Type by ID. Note that this
  schema permits additional properties on the same object.
type: object
properties:
  type:
    $ref: "schema:ethdebug/format/type/specifier"

required:
  - type

examples:
  - name: beneficiary
    type:
      kind: address
      payable: true
  - type:
      id: "<opaque-id>"

$defs:
  Array:
    title: '{ "type": ... }[]'
    description: A list of wrapped types, where the wrapper may add fields
    type: array
    items:
      $ref: "schema:ethdebug/format/type/wrapper"

  Object:
    title: '{ "key": { "type": ... }, ... }'
    description: A key-value mapping of wrapped types, where the wrapper may add fields
    type: object
    additionalProperties:
      $ref: "schema:ethdebug/format/type/wrapper"
`,"schema:ethdebug/format/type":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type"

title: ethdebug/format/type
description: Canonical representation for all types.
type: object

if:
  type: object
  title: Known kind
  description: If \`kind\` adheres to the set of known kinds defined by this format
  properties:
    kind:
      anyOf:
        - $ref: "schema:ethdebug/format/type/elementary#/$defs/Kind"
        - $ref: "schema:ethdebug/format/type/complex#/$defs/Kind"

then:
  type: object
  title: KnownType
  description: Then the object must adhere to exactly one known kind of type
  allOf:
    - if:
        properties:
          kind:
            $ref: "schema:ethdebug/format/type/elementary#/$defs/Kind"
      then:
        $ref: "schema:ethdebug/format/type/elementary"
    - if:
        properties:
          kind:
            $ref: "schema:ethdebug/format/type/complex#/$defs/Kind"
      then:
        $ref: "schema:ethdebug/format/type/complex"

else:
  type: object
  description:
    Else the object must be a valid **ethdebug/format/type/base** with
    additional constraints
  allOf:
    - $ref: "schema:ethdebug/format/type/base"
    - title: Required \`class\` field
      required:
        - class
    - title: Specialized complex type \`contains\` field
      type: object
      if:
        description: If this object is a complex type
        properties:
          class:
            const: complex
      then:
        description: Then the \`contains\` field must adhere to
          **ethdebug/format/type/wrapper** schemas, not the
          **ethdebug/format/type/base** equivalent.

          (i.e., these additional constraints must apply recursively)
        properties:
          contains:
            oneOf:
              - $ref: "schema:ethdebug/format/type/wrapper"
              - $ref: "schema:ethdebug/format/type/wrapper#/$defs/Array"
              - $ref: "schema:ethdebug/format/type/wrapper#/$defs/Object"
`};var wt={merge:!0};function Wi({schema:n,pointer:e}){if(typeof e=="string"&&!e.startsWith("#"))throw new Error("`pointer` option must start with '#'");let t=e?{pointer:e}:{};return hs(n)?ps({schema:typeof n=="object"?n:{id:n},...t}):us(n)?fs({schema:n,...t}):ds({schema:n,...t})}function ps({schema:{id:n},pointer:e}){let[t,i]=n.split("#"),r=i?ms([`#${i}`,e]):e,s=an[t];if(!s)throw new Error(`Unknown schema with $id "${t}"`);let o=Wn(s,r),a=_e(o,wt),c=_e(s,wt);return{id:t,...r?{pointer:r}:{},yaml:o,schema:a,rootSchema:c}}function fs({schema:{yaml:n},pointer:e}){let t=Wn(n,e),i=_e(t,wt),r=_e(n,wt),s=i.$id;return s?{id:s,...e?{pointer:e}:{},yaml:t,schema:i,rootSchema:r}:{...e?{pointer:e}:{},yaml:t,schema:i,rootSchema:r}}function ds({schema:n,pointer:e}){let t=on(n),i=Wn(t,e),r=_e(i,wt),s=r.$id;return s?{id:s,...e?{pointer:e}:{},yaml:i,schema:r,rootSchema:n}:{...e?{pointer:e}:{},yaml:i,schema:r,rootSchema:n}}function ms(n){let e=n.filter(t=>typeof t=="string").map(t=>t.slice(1)).join("");if(e.length!==0)return`#${e}`}function Wn(n,e){if(!e)return n;let t=sn(n);for(let i of e.slice(2).split("/"))if(t=t.get(i,!0),!t)throw new Error(`Pointer ${e} not found in schema`);return on(t)}function hs(n){return typeof n=="string"||Object.keys(n).length===1&&"id"in n}function us(n){return typeof n=="object"&&Object.keys(n).length===1&&"yaml"in n}var Gi=Object.keys(an),gs=Gi.map(n=>({[n]:Wi({schema:{id:n}}).schema})).reduce((n,e)=>({...n,...e}),{});var Gn="0.1.0-draft.1";var ge;(a=>{a.isValue=c=>[a.isUnsigned,a.isHex].some(l=>l(c)),a.isUnsigned=c=>typeof c=="number"&&c>=0;let t=new RegExp(/^0x[0-9a-fA-F]{1,}$/);a.isHex=c=>typeof c=="string"&&t.test(c),a.stamp=(c,l)=>({ethdebug:{schema:c,version:Gn},...l}),a.versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/,a.isStamp=c=>typeof c=="object"&&!!c&&"schema"in c&&typeof c.schema=="string"&&"version"in c&&typeof c.version=="string"&&a.versionPattern.test(c.version)&&Object.keys(c).length===2})(ge||={});var ve;(o=>{o.isId=a=>["number","string"].includes(typeof a),o.isReference=a=>typeof a=="object"&&!!a&&"id"in a&&(0,o.isId)(a.id);function t(a){return{id:a.id,...[[o.isCompilation,"compilation"],[o.isSource,"source"]].filter(([c])=>c(a)).map(([c,l])=>({type:l}))[0]||{}}}o.toReference=t,o.isCompilation=a=>typeof a=="object"&&!!a&&"id"in a&&(0,o.isId)(a.id)&&"compiler"in a&&typeof a.compiler=="object"&&!!a.compiler&&"name"in a.compiler&&typeof a.compiler.name=="string"&&"version"in a.compiler&&typeof a.compiler.version=="string"&&"sources"in a&&Array.isArray(a.sources)&&a.sources.every(o.isSource),o.isSource=a=>typeof a=="object"&&!!a&&"id"in a&&(0,o.isId)(a.id)&&"path"in a&&typeof a.path=="string"&&"contents"in a&&typeof a.contents=="string"&&"language"in a&&typeof a.language=="string"&&(!("encoding"in a)||typeof a.encoding=="string"),o.isSourceRange=a=>typeof a=="object"&&!!a&&"source"in a&&(0,o.isReference)(a.source)&&(!("range"in a)||typeof a.range=="object"&&!!a.range&&"offset"in a.range&&ge.isValue(a.range.offset)&&"length"in a.range&&ge.isValue(a.range.length))&&(!("compilation"in a)||(0,o.isReference)(a.compilation))})(ve||={});var Yn={};Cr(Yn,{isComplex:()=>Xi,isElementary:()=>Qi,isType:()=>Yi,isWrapper:()=>cn});var Yi=n=>[Qi,Xi].some(e=>e(n)),Qi=n=>typeof n=="object"&&!!n&&"kind"in n&&typeof n.kind=="string"&&(!("class"in n)||n.class==="elementary")&&!("contains"in n),Xi=n=>typeof n=="object"&&!!n&&"kind"in n&&typeof n.kind=="string"&&(!("class"in n)||n.class==="complex")&&"contains"in n&&!!n.contains&&(cn(n.contains)||Array.isArray(n.contains)&&n.contains.every(cn)||typeof n.contains=="object"&&Object.values(n.contains).every(cn)),cn=n=>typeof n=="object"&&!!n&&"type"in n&&(Yi(n.type)||typeof n.type=="object"&&!!n.type&&"id"in n.type);var ys=n=>Pe.hasElementaryKind(n)||Pe.hasComplexKind(n)?Pe.isKnown(n):Pe.isUnknown(n),Pe;(u=>{u.Base=Yn,u.isKnown=g=>[u.isElementary,u.isComplex].some(h=>h(g)),u.isUnknown=g=>u.Base.isType(g)&&"class"in g&&(!("contains"in g)||u.isWrapper(g.contains)||Array.isArray(g.contains)&&g.contains.every(u.isWrapper)||typeof g.contains=="object"&&Object.values(g.contains).every(u.isWrapper)),u.isReference=g=>typeof g=="object"&&!!g&&"id"in g&&(typeof g.id=="string"||typeof g.id=="number"),u.isSpecifier=g=>ys(g)||(0,u.isReference)(g),u.isWrapper=g=>typeof g=="object"&&!!g&&"type"in g&&(0,u.isSpecifier)(g.type),u.hasElementaryKind=g=>typeof g=="object"&&!!g&&"kind"in g&&typeof g.kind=="string"&&["uint","int","ufixed","fixed","bool","bytes","string","address","contract","enum"].includes(g.kind),u.isElementary=g=>[c.isUint,c.isInt,c.isUfixed,c.isFixed,c.isBool,c.isBytes,c.isString,c.isAddress,c.isContract,c.isEnum].some(h=>h(g));let c;(k=>(k.isUint=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"uint")&&"bits"in w&&typeof w.bits=="number"&&w.bits>=8&&w.bits<=256&&w.bits%8===0,k.isInt=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"int")&&"bits"in w&&typeof w.bits=="number"&&w.bits>=8&&w.bits<=256&&w.bits%8===0,k.isUfixed=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"ufixed")&&"bits"in w&&typeof w.bits=="number"&&w.bits>=8&&w.bits<=256&&w.bits%8===0&&"places"in w&&typeof w.places=="number"&&w.places>=1&&w.places<=80,k.isFixed=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"fixed")&&"bits"in w&&typeof w.bits=="number"&&w.bits>=8&&w.bits<=256&&w.bits%8===0&&"places"in w&&typeof w.places=="number"&&w.places>=1&&w.places<=80,k.isBool=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"bool"),k.isBytes=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"bytes")&&(!("size"in w)||ge.isUnsigned(w.size)),k.isString=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"string")&&(!("encoding"in w)||typeof w.encoding=="string"),k.isAddress=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"address")&&(!("payable"in w)||typeof w.payable=="boolean"),k.isContract=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"contract")&&(!("payable"in w)||typeof w.payable=="boolean")&&(!("library"in w)||typeof w.library=="boolean")&&(!("interface"in w)||typeof w.interface=="boolean")&&!("library"in w&&w.library===!0&&"interface"in w&&w.interface===!0)&&(!("definition"in w)||(0,u.isDefinition)(w.definition)),k.isEnum=w=>typeof w=="object"&&!!w&&F(w,"elementary")&&J(w,"enum")&&"values"in w&&Array.isArray(w.values)&&(!("definition"in w)||(0,u.isDefinition)(w.definition))))(c=u.Elementary||={}),u.hasComplexKind=g=>typeof g=="object"&&!!g&&"kind"in g&&typeof g.kind=="string"&&["alias","tuple","array","mapping","struct"].includes(g.kind),u.isComplex=g=>[p.isAlias,p.isTuple,p.isArray,p.isMapping,p.isStruct].some(h=>h(g));let p;($=>($.isAlias=d=>typeof d=="object"&&!!d&&F(d,"complex")&&J(d,"alias")&&"contains"in d&&(0,u.isWrapper)(d.contains)&&(!("definition"in d)||(0,u.isDefinition)(d.definition)),$.isTuple=d=>typeof d=="object"&&!!d&&F(d,"complex")&&J(d,"tuple")&&"contains"in d&&Array.isArray(d.contains)&&d.contains.every(S=>(0,u.isWrapper)(S)&&(!("name"in S)||typeof S.name=="string")),$.isArray=d=>typeof d=="object"&&!!d&&F(d,"complex")&&J(d,"array")&&"contains"in d&&(0,u.isWrapper)(d.contains),$.isMapping=d=>typeof d=="object"&&!!d&&F(d,"complex")&&J(d,"mapping")&&"contains"in d&&typeof d.contains=="object"&&!!d.contains&&"key"in d.contains&&(0,u.isWrapper)(d.contains.key)&&"value"in d.contains&&(0,u.isWrapper)(d.contains.value),$.isStruct=d=>typeof d=="object"&&!!d&&F(d,"complex")&&J(d,"struct")&&"contains"in d&&Array.isArray(d.contains)&&d.contains.every(S=>(0,u.isWrapper)(S)&&(!("name"in S)||typeof S.name=="string"))&&(!("definition"in d)||(0,u.isDefinition)(d.definition))))(p=u.Complex||={}),u.isDefinition=g=>typeof g=="object"&&!!g&&(!("name"in g)||typeof g.name=="string")&&(!("location"in g)||ve.isSourceRange(g.location))&&(Object.keys(g).includes("name")||Object.keys(g).includes("location"))})(Pe||={});var F=(n,e)=>!("class"in n)||n.class===e,J=(n,e)=>"kind"in n&&n.kind===e;var le=n=>[T.isRegion,T.isCollection].some(e=>e(n)),T;(f=>{f.isIdentifier=p=>typeof p=="string"&&/^[a-zA-Z_-]+[a-zA-Z0-9$_-]*$/.test(p),f.isRegion=p=>[t.isStack,t.isMemory,t.isStorage,t.isCalldata,t.isReturndata,t.isTransient,t.isCode].some(m=>m(p));let t;($=>($.isBase=d=>!!d&&typeof d=="object"&&(!("name"in d)||typeof d.name=="string")&&"location"in d&&typeof d.location=="string",$.isStack=d=>(0,$.isBase)(d)&&i.isSegment(d)&&d.location==="stack",$.isMemory=d=>(0,$.isBase)(d)&&i.isSlice(d)&&d.location==="memory",$.isStorage=d=>(0,$.isBase)(d)&&i.isSegment(d)&&d.location==="storage",$.isCalldata=d=>(0,$.isBase)(d)&&i.isSlice(d)&&d.location==="calldata",$.isReturndata=d=>(0,$.isBase)(d)&&i.isSlice(d)&&d.location==="returndata",$.isTransient=d=>(0,$.isBase)(d)&&i.isSegment(d)&&d.location==="transient",$.isCode=d=>(0,$.isBase)(d)&&i.isSlice(d)&&d.location==="code"))(t=f.Region||={});let i;(u=>(u.isSegment=g=>!!g&&typeof g=="object"&&"slot"in g&&(0,f.isExpression)(g.slot)&&(!("offset"in g)||(0,f.isExpression)(g.offset))&&(!("length"in g)||(0,f.isExpression)(g.length)),u.isSlice=g=>!!g&&typeof g=="object"&&"offset"in g&&(0,f.isExpression)(g.offset)&&"length"in g&&(0,f.isExpression)(g.length)))(i=f.Scheme||={}),f.isCollection=p=>[s.isGroup,s.isList,s.isConditional,s.isScope,s.isReference,s.isTemplates].some(m=>m(p));let s;(y=>(y.isGroup=b=>!!b&&typeof b=="object"&&Object.keys(b).length===1&&"group"in b&&Array.isArray(b.group)&&b.group.length>=1&&b.group.every(le),y.isList=b=>!!b&&typeof b=="object"&&Object.keys(b).length===1&&"list"in b&&!!b.list&&typeof b.list=="object"&&Object.keys(b.list).length===3&&"count"in b.list&&(0,f.isExpression)(b.list.count)&&"each"in b.list&&(0,f.isIdentifier)(b.list.each)&&"is"in b.list&&le(b.list.is),y.isConditional=b=>!!b&&typeof b=="object"&&"if"in b&&(0,f.isExpression)(b.if)&&"then"in b&&le(b.then)&&(!("else"in b)||le(b.else)),y.isScope=b=>!!b&&typeof b=="object"&&"define"in b&&typeof b.define=="object"&&!!b.define&&Object.keys(b.define).every($=>(0,f.isIdentifier)($))&&"in"in b&&le(b.in),y.isReference=b=>!!b&&typeof b=="object"&&"template"in b&&typeof b.template=="string"&&!!b.template&&(!("yields"in b)||typeof b.yields=="object"&&b.yields!==null&&Object.entries(b.yields).every(([$,d])=>(0,f.isIdentifier)($)&&(0,f.isIdentifier)(d))),y.isTemplates=b=>!!b&&typeof b=="object"&&"templates"in b&&typeof b.templates=="object"&&!!b.templates&&Object.keys(b.templates).every(f.isIdentifier)&&Object.values(b.templates).every(f.isTemplate)&&"in"in b&&le(b.in)))(s=f.Collection||={}),f.isExpression=p=>[a.isLiteral,a.isConstant,a.isVariable,a.isArithmetic,a.isLookup,a.isRead,a.isKeccak256,a.isConcat,a.isResize].some(m=>m(p));let a;(P=>{P.isLiteral=O=>typeof O=="number"||typeof O=="string"&&/^0x[0-9a-fA-F]+$/.test(O),P.isConstant=O=>typeof O=="string"&&["~wordsize"].includes(O),P.isVariable=O=>(0,f.isIdentifier)(O),P.isArithmetic=O=>[y.isSum,y.isDifference,y.isProduct,y.isQuotient,y.isRemainder].some(L=>L(O));let h=(O,L)=>G=>!!G&&typeof G=="object"&&Object.keys(G).length===1&&O in G&&L(G[O]);P.isOperands=O=>Array.isArray(O)&&O.every(f.isExpression);let y;(ye=>(ye.isTwoOperands=si=>(0,P.isOperands)(si)&&si.length===2,ye.isSum=h("~sum",P.isOperands),ye.isDifference=h("~difference",ye.isTwoOperands),ye.isProduct=h("~product",P.isOperands),ye.isQuotient=h("~quotient",ye.isTwoOperands),ye.isRemainder=h("~remainder",ye.isTwoOperands)))(y=P.Arithmetic||={}),P.isReference=O=>(0,f.isIdentifier)(O)||O==="~this",P.isLookup=O=>[d.isOffset,d.isLength,d.isSlot].some(L=>L(O));let d;(Ae=>(Ae.propertyFrom=ri=>ri.slice(1),Ae.isOffset=h(".offset",P.isReference),Ae.isLength=h(".length",P.isReference),Ae.isSlot=h(".slot",P.isReference)))(d=P.Lookup||={}),P.isRead=h("~read",P.isReference),P.isKeccak256=h("~keccak256",P.isOperands),P.isConcat=h("~concat",P.isOperands),P.isResize=O=>[w.isToWordsize,w.isToNumber].some(L=>L(O));let w;(G=>(G.isToNumber=Y=>{if(!Y||typeof Y!="object"||Object.keys(Y).length!==1)return!1;let[Ae]=Object.keys(Y);return typeof Ae=="string"&&/^~sized([1-9]+[0-9]*)$/.test(Ae)},G.isToWordsize=Y=>!!Y&&typeof Y=="object"&&Object.keys(Y).length===1&&"~wordsized"in Y&&typeof Y["~wordsized"]<"u"&&(0,f.isExpression)(Y["~wordsized"])))(w=P.Resize||={})})(a=f.Expression||={}),f.isTemplates=p=>!!p&&typeof p=="object"&&Object.keys(p).every(f.isIdentifier)&&Object.values(p).every(f.isTemplate),f.isTemplate=p=>!!p&&typeof p=="object"&&Object.keys(p).length===2&&"expect"in p&&Array.isArray(p.expect)&&p.expect.every(f.isIdentifier)&&"for"in p&&le(p.for)})(T||={});var Xe=n=>[W.isName,W.isCode,W.isVariables,W.isRemark,W.isPick,W.isFrame,W.isGather,W.isInvoke,W.isReturn,W.isRevert,W.isTransform].some(e=>e(n)),W;(x=>{x.isName=y=>typeof y=="object"&&!!y&&"name"in y&&typeof y.name=="string",x.isCode=y=>typeof y=="object"&&!!y&&"code"in y&&ve.isSourceRange(y.code),x.isVariables=y=>typeof y=="object"&&!!y&&"variables"in y&&Array.isArray(y.variables)&&y.variables.length>0&&y.variables.every(i.isVariable);let i;($=>{let y=new Set(["identifier","declaration","type","pointer"]);$.isVariable=d=>typeof d=="object"&&!!d&&Object.keys(d).length>0&&Object.keys(d).every(S=>y.has(S))&&(!("identifier"in d)||typeof d.identifier=="string")&&(!("declaration"in d)||ve.isSourceRange(d.declaration))&&(!("type"in d)||Pe.isSpecifier(d.type))&&(!("pointer"in d)||le(d.pointer))})(i=x.Variables||={}),x.isRemark=y=>typeof y=="object"&&!!y&&"remark"in y&&typeof y.remark=="string",x.isPick=y=>typeof y=="object"&&!!y&&"pick"in y&&Array.isArray(y.pick)&&y.pick.every(Xe),x.isGather=y=>typeof y=="object"&&!!y&&"gather"in y&&Array.isArray(y.gather)&&y.gather.every(Xe),x.isFrame=y=>typeof y=="object"&&!!y&&"frame"in y&&typeof y.frame=="string";let c;($=>($.isIdentity=d=>typeof d=="object"&&!!d&&(!("identifier"in d)||typeof d.identifier=="string")&&(!("declaration"in d)||ve.isSourceRange(d.declaration))&&(!("type"in d)||Pe.isSpecifier(d.type)),$.isPointerRef=d=>typeof d=="object"&&!!d&&"pointer"in d&&le(d.pointer)))(c=x.Function||={}),x.isInvoke=y=>typeof y=="object"&&!!y&&"invoke"in y&&f.isInvocation(y.invoke);let f;($=>{$.isInvocation=d=>c.isIdentity(d)&&(!("activation"in d)||typeof d.activation=="string")&&(b.isInternalCall(d)||b.isExternalCall(d)||b.isContractCreation(d));let b;(I=>(I.isInternalCall=k=>typeof k=="object"&&!!k&&"jump"in k&&k.jump===!0&&(!("target"in k)||c.isPointerRef(k.target))&&(!("arguments"in k)||c.isPointerRef(k.arguments)),I.isExternalCall=k=>typeof k=="object"&&!!k&&"message"in k&&k.message===!0&&"target"in k&&c.isPointerRef(k.target)&&(!("gas"in k)||c.isPointerRef(k.gas))&&(!("value"in k)||c.isPointerRef(k.value))&&(!("input"in k)||c.isPointerRef(k.input))&&(!("delegate"in k)||k.delegate===!0)&&(!("static"in k)||k.static===!0),I.isContractCreation=k=>typeof k=="object"&&!!k&&"create"in k&&k.create===!0&&(!("value"in k)||c.isPointerRef(k.value))&&(!("salt"in k)||c.isPointerRef(k.salt))&&(!("input"in k)||c.isPointerRef(k.input))))(b=$.Invocation||={})})(f=x.Invoke||={}),x.isReturn=y=>typeof y=="object"&&!!y&&"return"in y&&m.isInfo(y.return);let m;(b=>b.isInfo=$=>c.isIdentity($)&&typeof $=="object"&&!!$&&(!("data"in $)||c.isPointerRef($.data))&&(!("success"in $)||c.isPointerRef($.success))&&(!("activation"in $)||typeof $.activation=="string"))(m=x.Return||={}),x.isRevert=y=>typeof y=="object"&&!!y&&"revert"in y&&g.isInfo(y.revert);let g;(b=>b.isInfo=$=>c.isIdentity($)&&typeof $=="object"&&!!$&&(!("reason"in $)||c.isPointerRef($.reason))&&(!("panic"in $)||typeof $.panic=="number")&&(!("activation"in $)||typeof $.activation=="string"))(g=x.Revert||={}),x.isTransform=y=>typeof y=="object"&&!!y&&"transform"in y&&Array.isArray(y.transform)&&y.transform.length>0&&y.transform.every(b=>typeof b=="string"&&b.length>0)})(W||={});var Zi=n=>typeof n=="object"&&!!n&&"offset"in n&&ge.isValue(n.offset)&&(!("context"in n)||Xe(n.context))&&(!("operation"in n)||ln.isOperation(n.operation)),ln;(e=>e.isOperation=t=>typeof t=="object"&&!!t&&"mnemonic"in t&&typeof t.mnemonic=="string"&&(!("arguments"in t)||Array.isArray(t.arguments)&&t.arguments.every(ge.isValue)))(ln||={});var er;(o=>(o.Context=W,o.isContext=Xe,o.Instruction=ln,o.isInstruction=Zi,o.isEnvironment=a=>typeof a=="string"&&["call","create"].includes(a),o.isContract=a=>typeof a=="object"&&!!a&&"definition"in a&&ve.isSourceRange(a.definition)&&(!("name"in a)||typeof a.name=="string")))(er||={});function Ze(n){if(!Number.isSafeInteger(n)||n<0)throw new Error(`positive integer expected, not ${n}`)}function bs(n){if(typeof n!="boolean")throw new Error(`boolean expected, not ${n}`)}function xs(n){return n instanceof Uint8Array||n!=null&&typeof n=="object"&&n.constructor.name==="Uint8Array"}function ze(n,...e){if(!xs(n))throw new Error("Uint8Array expected");if(e.length>0&&!e.includes(n.length))throw new Error(`Uint8Array expected of length ${e}, not of length=${n.length}`)}function ws(n){if(typeof n!="function"||typeof n.create!="function")throw new Error("Hash should be wrapped by utils.wrapConstructor");Ze(n.outputLen),Ze(n.blockLen)}function pn(n,e=!0){if(n.destroyed)throw new Error("Hash instance has been destroyed");if(e&&n.finished)throw new Error("Hash#digest() has already been called")}function Qn(n,e){ze(n);let t=e.outputLen;if(n.length<t)throw new Error(`digestInto() expects output buffer of length at least ${t}`)}var ks={number:Ze,bool:bs,bytes:ze,hash:ws,exists:pn,output:Qn},fn=ks;var tr=n=>new Uint32Array(n.buffer,n.byteOffset,Math.floor(n.byteLength/4));var Xn=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68,$s=n=>n<<24&4278190080|n<<8&16711680|n>>>8&65280|n>>>24&255;function Zn(n){for(let e=0;e<n.length;e++)n[e]=$s(n[e])}var vs=Array.from({length:256},(n,e)=>e.toString(16).padStart(2,"0"));function mn(n){ze(n);let e="";for(let t=0;t<n.length;t++)e+=vs[n[t]];return e}function nr(n){if(typeof n!="string")throw new Error(`utf8ToBytes expected string, got ${typeof n}`);return new Uint8Array(new TextEncoder().encode(n))}function hn(n){return typeof n=="string"&&(n=nr(n)),ze(n),n}var dn=class{clone(){return this._cloneInto()}},Vd={}.toString;function ir(n){let e=i=>n().update(hn(i)).digest(),t=n();return e.outputLen=t.outputLen,e.blockLen=t.blockLen,e.create=()=>n(),e}function rr(n){let e=(i,r)=>n(r).update(hn(i)).digest(),t=n({});return e.outputLen=t.outputLen,e.blockLen=t.blockLen,e.create=i=>n(i),e}var Gd=fn.bool,Yd=fn.bytes;function kt(n){return e=>(fn.bytes(e),n(e))}var Qd=(()=>{let n=typeof globalThis=="object"&&"crypto"in globalThis?globalThis.crypto:void 0,e=typeof module<"u"&&typeof module.require=="function"&&module.require.bind(module);return{node:e&&!n?e("crypto"):void 0,web:n}})();var Ss=Symbol.for("nodejs.util.inspect.custom"),D=class n extends Uint8Array{static zero(){return new n([])}static fromUint(e){if(e===0n)return this.zero();let t=Math.ceil(Number(e.toString(2).length)/8),i=new Uint8Array(t);for(let r=t-1;r>=0;r--)i[r]=Number(e&0xffn),e>>=8n;return new n(i)}static fromNumber(e){let t=Math.ceil(Math.log2(e+1)/8),i=new Uint8Array(t);for(let r=t-1;r>=0;r--)i[r]=e&255,e>>=8;return new n(i)}static fromHex(e){if(!e.startsWith("0x"))throw new Error('Invalid hex string format. Expected "0x" prefix.');let t=new Uint8Array((e.length-2)/2+.5);for(let i=2;i<e.length;i+=2)t[i/2-1]=parseInt(e.slice(i,i+2),16);return new n(t)}static fromBytes(e){return new n(e)}asUint(){let e=8n,t=0n;for(let i of this.values()){let r=BigInt(i);t=(t<<e)+r}return t}toHex(){return`0x${mn(this)}`}padUntilAtLeast(e){if(this.length>=e)return this;let t=new Uint8Array(e);return t.set(this,e-this.length),n.fromBytes(t)}resizeTo(e){if(this.length===e)return this;let t=new Uint8Array(e);return this.length<e?t.set(this,e-this.length):t.set(this.slice(this.length-e)),n.fromBytes(t)}concat(...e){let t=[this,...e].map(i=>i.toHex().slice(2)).reduce((i,r)=>`${i}${r}`,"0x");return n.fromHex(t)}inspect(e,t,i){return`Data[${t.stylize(this.toHex(),"number")}]`}[Ss](e,t,i){return this.inspect(e,t,i)}};async function et(n,e){let{location:t}=n,{state:i}=e;switch(t){case"stack":{let{slot:r,offset:s,length:o}=Be(["slot","offset","length"],n);return await ei({offset:s,length:o},(a,c)=>i.stack.peek({depth:r+a,slice:c}))}case"memory":{let{offset:r,length:s}=Be(["offset","length"],n);return await i.memory.read({slice:{offset:r,length:s}})}case"storage":{let{slot:r}=n,{offset:s,length:o}=Be(["offset","length"],n);return await ei({offset:s,length:o},(a,c)=>i.storage.read({slot:sr(r,a),slice:c}))}case"calldata":{let{offset:r,length:s}=Be(["offset","length"],n);return await i.calldata.read({slice:{offset:r,length:s}})}case"returndata":{let{offset:r,length:s}=Be(["offset","length"],n);return await i.returndata.read({slice:{offset:r,length:s}})}case"transient":{let{slot:r}=n,{offset:s,length:o}=Be(["offset","length"],n);return await ei({offset:s,length:o},(a,c)=>i.transient.read({slot:sr(r,a),slice:c}))}case"code":{let{offset:r,length:s}=Be(["offset","length"],n);return await i.code.read({slice:{offset:r,length:s}})}}}var De=32n;async function ei({offset:n=0n,length:e},t){let i=n/De,r=n%De,s=e??De-r;if(s===0n)return D.zero();let o=r+s,a=(o+De-1n)/De,c=[];for(let l=0n;l<a;l++){let f=l===0n?r:0n,p=l===a-1n?o-l*De:De;c.push(await t(i+l,{offset:f,length:p-f}))}return D.zero().concat(...c)}function sr(n,e){return e===0n?n:D.fromUint(n.asUint()+e).padUntilAtLeast(n.length)}function Be(n,e){let t={};for(let i of n){let r=e[i];typeof r<"u"&&(t[i]=r.asUint())}return t}var un=BigInt(4294967295),or=BigInt(32);function As(n,e=!1){return e?{h:Number(n&un),l:Number(n>>or&un)}:{h:Number(n>>or&un)|0,l:Number(n&un)|0}}function ar(n,e=!1){let t=new Uint32Array(n.length),i=new Uint32Array(n.length);for(let r=0;r<n.length;r++){let{h:s,l:o}=As(n[r],e);[t[r],i[r]]=[s,o]}return[t,i]}var cr=(n,e,t)=>n<<t|e>>>32-t,lr=(n,e,t)=>e<<t|n>>>32-t,pr=(n,e,t)=>e<<t-32|n>>>64-t,fr=(n,e,t)=>n<<t-32|e>>>64-t;var hr=[],ur=[],gr=[],Ts=BigInt(0),$t=BigInt(1),js=BigInt(2),Os=BigInt(7),Es=BigInt(256),Cs=BigInt(113);for(let n=0,e=$t,t=1,i=0;n<24;n++){[t,i]=[i,(2*t+3*i)%5],hr.push(2*(5*i+t)),ur.push((n+1)*(n+2)/2%64);let r=Ts;for(let s=0;s<7;s++)e=(e<<$t^(e>>Os)*Cs)%Es,e&js&&(r^=$t<<($t<<BigInt(s))-$t);gr.push(r)}var[Is,Ps]=ar(gr,!0),dr=(n,e,t)=>t>32?pr(n,e,t):cr(n,e,t),mr=(n,e,t)=>t>32?fr(n,e,t):lr(n,e,t);function qs(n,e=24){let t=new Uint32Array(10);for(let i=24-e;i<24;i++){for(let o=0;o<10;o++)t[o]=n[o]^n[o+10]^n[o+20]^n[o+30]^n[o+40];for(let o=0;o<10;o+=2){let a=(o+8)%10,c=(o+2)%10,l=t[c],f=t[c+1],p=dr(l,f,1)^t[a],m=mr(l,f,1)^t[a+1];for(let u=0;u<50;u+=10)n[o+u]^=p,n[o+u+1]^=m}let r=n[2],s=n[3];for(let o=0;o<24;o++){let a=ur[o],c=dr(r,s,a),l=mr(r,s,a),f=hr[o];r=n[f],s=n[f+1],n[f]=c,n[f+1]=l}for(let o=0;o<50;o+=10){for(let a=0;a<10;a++)t[a]=n[o+a];for(let a=0;a<10;a++)n[o+a]^=~t[(a+2)%10]&t[(a+4)%10]}n[0]^=Is[i],n[1]^=Ps[i]}t.fill(0)}var gn=class n extends dn{constructor(e,t,i,r=!1,s=24){if(super(),this.blockLen=e,this.suffix=t,this.outputLen=i,this.enableXOF=r,this.rounds=s,this.pos=0,this.posOut=0,this.finished=!1,this.destroyed=!1,Ze(i),0>=this.blockLen||this.blockLen>=200)throw new Error("Sha3 supports only keccak-f1600 function");this.state=new Uint8Array(200),this.state32=tr(this.state)}keccak(){Xn||Zn(this.state32),qs(this.state32,this.rounds),Xn||Zn(this.state32),this.posOut=0,this.pos=0}update(e){pn(this);let{blockLen:t,state:i}=this;e=hn(e);let r=e.length;for(let s=0;s<r;){let o=Math.min(t-this.pos,r-s);for(let a=0;a<o;a++)i[this.pos++]^=e[s++];this.pos===t&&this.keccak()}return this}finish(){if(this.finished)return;this.finished=!0;let{state:e,suffix:t,pos:i,blockLen:r}=this;e[i]^=t,(t&128)!==0&&i===r-1&&this.keccak(),e[r-1]^=128,this.keccak()}writeInto(e){pn(this,!1),ze(e),this.finish();let t=this.state,{blockLen:i}=this;for(let r=0,s=e.length;r<s;){this.posOut>=i&&this.keccak();let o=Math.min(i-this.posOut,s-r);e.set(t.subarray(this.posOut,this.posOut+o),r),this.posOut+=o,r+=o}return e}xofInto(e){if(!this.enableXOF)throw new Error("XOF is not possible for this instance");return this.writeInto(e)}xof(e){return Ze(e),this.xofInto(new Uint8Array(e))}digestInto(e){if(Qn(e,this),this.finished)throw new Error("digest() was already called");return this.writeInto(e),this.destroy(),e}digest(){return this.digestInto(new Uint8Array(this.outputLen))}destroy(){this.destroyed=!0,this.state.fill(0)}_cloneInto(e){let{blockLen:t,suffix:i,outputLen:r,rounds:s,enableXOF:o}=this;return e||(e=new n(t,i,r,o,s)),e.state32.set(this.state32),e.pos=this.pos,e.posOut=this.posOut,e.finished=this.finished,e.rounds=s,e.suffix=i,e.outputLen=r,e.enableXOF=o,e.destroyed=this.destroyed,e}},qe=(n,e,t)=>ir(()=>new gn(e,n,t)),cm=qe(6,144,224/8),lm=qe(6,136,256/8),pm=qe(6,104,384/8),fm=qe(6,72,512/8),yr=qe(1,144,224/8),ti=qe(1,136,256/8),br=qe(1,104,384/8),xr=qe(1,72,512/8),wr=(n,e,t)=>rr((i={})=>new gn(e,n,i.dkLen===void 0?t:i.dkLen,!0)),dm=wr(31,168,128/8),mm=wr(31,136,256/8);var ym=kt(yr),yn=(()=>{let n=kt(ti);return n.create=ti.create,n})(),bm=kt(br),xm=kt(xr);var N;(o=>(o.integer=a=>({sort:"integer",value:a}),o.bytes=a=>({sort:"bytes",data:a}),o.isInteger=a=>a.sort==="integer",o.isBytes=a=>a.sort==="bytes",o.toInteger=a=>(0,o.isInteger)(a)?a.value:a.data.asUint(),o.toData=a=>(0,o.isBytes)(a)?a.data:D.fromUint(a.value)))(N||={});async function Se(n,e){if(T.Expression.isLiteral(n))return zs(n);if(T.Expression.isConstant(n))return Ds(n);if(T.Expression.isVariable(n))return Bs(n,e);if(T.Expression.isArithmetic(n))return Ms(n,e);if(T.Expression.isKeccak256(n))return Us(n,e);if(T.Expression.isConcat(n))return Ks(n,e);if(T.Expression.isResize(n))return Vs(n,e);if(T.Expression.isLookup(n)){if(T.Expression.Lookup.isOffset(n))return ni(".offset",n,e);if(T.Expression.Lookup.isLength(n))return ni(".length",n,e);if(T.Expression.Lookup.isSlot(n))return ni(".slot",n,e)}if(T.Expression.isRead(n))return Fs(n,e);throw new Error(`Unexpected runtime failure to recognize kind of expression: ${JSON.stringify(n)}${Rs(...Ns(n))}`)}var Ls=new RegExp("^\\$(wordsize|this|sum|difference|product|quotient|remainder|read|keccak256|concat|wordsized|sized\\d+)$");function Ns(n){return typeof n=="string"?[n]:n&&typeof n=="object"?[...Object.keys(n),...Object.values(n).filter(e=>typeof e=="string")]:[]}function Rs(...n){let e=n.find(t=>Ls.test(t));return e?`; did you mean \`~${e.slice(1)}\`? (the expression sigil changed from \`$\` to \`~\`)`:""}async function _s(n,e){return N.toInteger(await Se(n,e))}async function kr(n,e,t){return await Promise.all(e.map(async(i,r)=>{let s=await Se(i,t);if(N.isInteger(s))throw new Error([`Operand ${r} of ${n} (${JSON.stringify(i)}) `,`evaluates to the integer ${s.value}, which has no byte `,"width; give it a width with ~wordsized or ~sizedN"].join(""));return s.data}))}async function zs(n){switch(typeof n){case"string":return n.slice(2).length%2===1?N.integer(BigInt(n)):N.bytes(D.fromHex(n));case"number":return N.integer(BigInt(n))}}async function Ds(n){switch(n){case"~wordsize":return N.integer(32n)}}async function Bs(n,{variables:e}){let t=e[n];if(typeof t>"u")throw new Error(`Unknown variable with identifier ${n}`);return t}async function Ms(n,e){let[[t,i]]=Object.entries(n),r=await Promise.all(i.map(s=>_s(s,e)));switch(t){case"~sum":return N.integer(r.reduce((s,o)=>s+o,0n));case"~difference":{let[s,o]=r;return N.integer(s>o?s-o:0n)}case"~product":return N.integer(r.reduce((s,o)=>s*o,1n));case"~quotient":{let[s,o]=r;return N.integer(s/o)}case"~remainder":{let[s,o]=r;return N.integer(s%o)}}throw new Error(`Unknown arithmetic operation ${t}`)}async function Us(n,e){let t=await kr("~keccak256",n["~keccak256"],e),i=D.zero().concat(...t);return N.bytes(D.fromBytes(yn(i)))}async function Ks(n,e){let t=await kr("~concat",n["~concat"],e);return N.bytes(D.zero().concat(...t))}async function Vs(n,e){let[[t,i]]=Object.entries(n),r=T.Expression.Resize.isToNumber(n)?Number(t.match(/^~sized([1-9]+[0-9]*)$/)[1]):32,s=await Se(i,e);return N.bytes(N.toData(s).resizeTo(r))}async function ni(n,e,t){let{regions:i}=t,r=e[n],s=i[r];if(!s)throw new Error(`Region not found: ${r}`);let o=T.Expression.Lookup.propertyFrom(n),a=s[o];if(typeof a>"u")throw new Error(`Region named ${r} does not have ${o} needed by lookup`);return N.integer(a.asUint())}async function Fs(n,e){let{state:t,regions:i}=e,r=n["~read"],s=i[r];if(!s)throw new Error(`Region not found: ${r}`);return N.bytes(await et(s,e))}async function $r(n,e){let t={},i={},r=new Proxy({...n},{get(a,c){if(c in t)return t[c];throw new Error(`Property not evaluated yet: ~this.${c.toString()}`)}}),s=["slot","offset","length"],o=s.filter(a=>a in n).map(a=>[a,n[a]]);for(;o.length>0;){let[a,c]=o.shift();try{let l=await Se(c,{...e,regions:{...e.regions,"~this":r}});t[a]=N.toData(l)}catch(l){if(l instanceof Error&&l.message.startsWith("Property not evaluated yet: ~this.")){let f=i[a]||0;if(f>s.length-1)throw new Error(`Circular reference detected: ~this.${a.toString()}`);i[a]=f+1,o.push([a,c])}else throw l}}return{...n,...t}}function vr(n,e){if(T.Region.isStack(n)){let t=e===0n?n.slot:e>0n?{"~sum":[n.slot,`0x${e.toString(16)}`]}:{"~difference":[n.slot,`0x${-e.toString(16)}`]};return{...n,slot:t}}return n}async function*Sr(n,e){if(T.isRegion(n))return yield*Js(n,e);let t=n;if(T.Collection.isGroup(t))return yield*Hs(t,e);if(T.Collection.isList(t))return yield*Ws(t,e);if(T.Collection.isConditional(t))return yield*Gs(t,e);if(T.Collection.isScope(t))return yield*Ys(t,e);if(T.Collection.isReference(t))return yield*Qs(t,e);if(T.Collection.isTemplates(t))return yield*Xs(t,e);throw console.error("%s",JSON.stringify(n,void 0,2)),new Error("Unexpected unknown kind of pointer")}async function*Js(n,{stackLengthChange:e,...t}){let i=await $r(vr(n,e),t);return yield i,typeof n.name<"u"?[z.saveRegions({[n.name]:i})]:[]}async function*Hs(n,e){let{group:t}=n;return t.map(z.dereferencePointer)}async function*Ws(n,e){let{list:t}=n,{count:i,each:r,is:s}=t,o=N.toInteger(await Se(i,e)),a=[];for(let c=0n;c<o;c++)a.push(z.saveVariables({[r]:N.integer(c)})),a.push(z.dereferencePointer(s));return a}async function*Gs(n,e){let{if:t,then:i,else:r}=n;return N.toInteger(await Se(t,e))?[z.dereferencePointer(i)]:r?[z.dereferencePointer(r)]:[]}async function*Ys(n,e){let{define:t,in:i}=n,r=Object.assign(Object.create(null),e.variables),s={};for(let[o,a]of Object.entries(t)){let c=await Se(a,{...e,variables:r});r[o]=c,s[o]=c}return[z.saveVariables(s),z.dereferencePointer(i),z.restoreVariables(Object.assign(Object.create(null),e.variables))]}async function*Qs(n,e){let{template:t,yields:i}=n,{templates:r,variables:s}=e,o=r[t];if(!o)throw new Error(`Unknown pointer template named ${t}`);let{expect:a,for:c}=o,l=new Set(Object.keys(s)),f=a.filter(p=>!l.has(p));if(f.length>0)throw new Error([`Invalid reference to template named ${t}; missing expected `,`variables with identifiers: ${f.join(", ")}. `,"Please ensure these variables are defined prior to this reference."].join(""));return i&&Object.keys(i).length>0?[z.pushRegionRenames(i),z.dereferencePointer(c),z.popRegionRenames()]:[z.dereferencePointer(c)]}async function*Xs(n,e){let{templates:t,in:i}=n;return[z.pushTemplates(t),z.dereferencePointer(i),z.popTemplates()]}async function*Ar(n,e){let t=await eo(e),{regions:i,variables:r}=t,s=[],o=[],a=[z.dereferencePointer(n)];for(;a.length>0;){let c=a.pop(),l=[];switch(c.kind){case"dereference-pointer":{let f=o.reduce((u,g)=>({...u,...g}),t.templates),p=Sr(c.pointer,{...t,templates:f}),m=await p.next();for(;!m.done;){let u=m.value;if(u.name){let g=s.reduceRight((h,x)=>Zs(x,h)?x[h]:h,u.name);g!==u.name&&(u={...u,name:g})}yield u,m=await p.next()}l=m.value;break}case"save-regions":{for(let[f,p]of Object.entries(c.regions))i[f]=p;break}case"save-variables":{Object.assign(r,c.variables);break}case"restore-variables":{for(let f of Object.keys(r))delete r[f];Object.assign(r,c.variables);break}case"push-region-renames":{s.push(c.mapping);break}case"pop-region-renames":{let f=s.pop();if(f)for(let[p,m]of Object.entries(f))p in i&&m!==p&&(i[m]={...i[p],name:m});break}case"push-templates":{o.push(c.templates);break}case"pop-templates":{o.pop();break}}for(let f=l.length-1;f>=0;f--)a.push(l[f])}}var Zs=(n,e)=>Object.prototype.hasOwnProperty.call(n,e);async function eo({templates:n,state:e,initialStackLength:t}){let r=await e.stack.length-t;return{templates:n,state:e,stackLengthChange:r,regions:Object.create(null),variables:Object.create(null)}}function Tr(n){return{async view(e){let t=[];for await(let a of n(e))t.push(a);let i=Object.create(null),r=Object.create(null),s={writable:!1,enumerable:!1,configurable:!1},o=Object.create(Array.prototype,{length:{value:t.length,...s}});for(let[a,c]of t.entries())Object.defineProperty(o,a,{value:c,...s,enumerable:!0}),typeof c.name=="string"&&(c.name in i||(i[c.name]=[]),i[c.name].push(c),r[c.name]=c);Object.defineProperties(o,{named:{value:a=>a in i?i[a]:[],...s},lookup:{value:r,...s}});for(let[a,c]of Object.entries(r))a in o||Object.defineProperty(o,a,{value:c,...s});return{regions:o,async read(a){return await et(a,{state:e})}}}}}async function jr(n,e={}){let t=await to(e);return Tr(r=>({async*[Symbol.asyncIterator](){yield*Ar(n,{...t,state:r})}}))}async function to({templates:n={},state:e}){let t=e?await e.stack.length:0n;return{templates:n,initialStackLength:t}}var M;(function(n){n.integer=e=>({sort:"integer",value:e}),n.bytes=e=>({sort:"bytes",data:e}),n.isInteger=e=>e.sort==="integer",n.isBytes=e=>e.sort==="bytes",n.toInteger=e=>n.isInteger(e)?e.value:e.data.asUint(),n.toData=e=>n.isBytes(e)?e.data:D.fromUint(e.value)})(M||(M={}));async function bn(n,e){if(T.Expression.isLiteral(n))return oo(n);if(T.Expression.isConstant(n))return ao(n);if(T.Expression.isVariable(n))return co(n,e);if(T.Expression.isArithmetic(n))return lo(n,e);if(T.Expression.isKeccak256(n))return po(n,e);if(T.Expression.isConcat(n))return fo(n,e);if(T.Expression.isResize(n))return mo(n,e);if(T.Expression.isLookup(n)){if(T.Expression.Lookup.isOffset(n))return ii(".offset",n,e);if(T.Expression.Lookup.isLength(n))return ii(".length",n,e);if(T.Expression.Lookup.isSlot(n))return ii(".slot",n,e)}if(T.Expression.isRead(n))return ho(n,e);throw new Error(`Unexpected runtime failure to recognize kind of expression: ${JSON.stringify(n)}${ro(...io(n))}`)}var no=new RegExp("^\\$(wordsize|this|sum|difference|product|quotient|remainder|read|keccak256|concat|wordsized|sized\\d+)$");function io(n){return typeof n=="string"?[n]:n&&typeof n=="object"?[...Object.keys(n),...Object.values(n).filter(e=>typeof e=="string")]:[]}function ro(...n){let e=n.find(t=>no.test(t));return e?`; did you mean \`~${e.slice(1)}\`? (the expression sigil changed from \`$\` to \`~\`)`:""}async function so(n,e){return M.toInteger(await bn(n,e))}async function Or(n,e,t){return await Promise.all(e.map(async(i,r)=>{let s=await bn(i,t);if(M.isInteger(s))throw new Error([`Operand ${r} of ${n} (${JSON.stringify(i)}) `,`evaluates to the integer ${s.value}, which has no byte `,"width; give it a width with ~wordsized or ~sizedN"].join(""));return s.data}))}async function oo(n){switch(typeof n){case"string":return n.slice(2).length%2===1?M.integer(BigInt(n)):M.bytes(D.fromHex(n));case"number":return M.integer(BigInt(n))}}async function ao(n){switch(n){case"~wordsize":return M.integer(32n)}}async function co(n,{variables:e}){let t=e[n];if(typeof t>"u")throw new Error(`Unknown variable with identifier ${n}`);return t}async function lo(n,e){let[[t,i]]=Object.entries(n),r=await Promise.all(i.map(s=>so(s,e)));switch(t){case"~sum":return M.integer(r.reduce((s,o)=>s+o,0n));case"~difference":{let[s,o]=r;return M.integer(s>o?s-o:0n)}case"~product":return M.integer(r.reduce((s,o)=>s*o,1n));case"~quotient":{let[s,o]=r;return M.integer(s/o)}case"~remainder":{let[s,o]=r;return M.integer(s%o)}}throw new Error(`Unknown arithmetic operation ${t}`)}async function po(n,e){let t=await Or("~keccak256",n["~keccak256"],e),i=D.zero().concat(...t);return M.bytes(D.fromBytes(yn(i)))}async function fo(n,e){let t=await Or("~concat",n["~concat"],e);return M.bytes(D.zero().concat(...t))}async function mo(n,e){let[[t,i]]=Object.entries(n),r=T.Expression.Resize.isToNumber(n)?Number(t.match(/^~sized([1-9]+[0-9]*)$/)[1]):32,s=await bn(i,e);return M.bytes(M.toData(s).resizeTo(r))}async function ii(n,e,t){let{regions:i}=t,r=e[n],s=i[r];if(!s)throw new Error(`Region not found: ${r}`);let o=T.Expression.Lookup.propertyFrom(n),a=s[o];if(typeof a>"u")throw new Error(`Region named ${r} does not have ${o} needed by lookup`);return M.integer(a.asUint())}async function ho(n,e){let{state:t,regions:i}=e,r=n["~read"],s=i[r];if(!s)throw new Error(`Region not found: ${r}`);return M.bytes(await et(s,e))}var Ym="d7cb421a36a3b4cef1a9d954da8316cf6e43424e";export{D as Data,Ym as commit,jr as dereference,bn as evaluate};
