var Li=Object.defineProperty,Ci=(e,t)=>{for(var n in t)Li(e,n,{get:t[n],enumerable:!0})},_;(e=>{e.dereferencePointer=t=>({kind:"dereference-pointer",pointer:t}),e.saveRegions=t=>({kind:"save-regions",regions:t}),e.saveVariables=t=>({kind:"save-variables",variables:t}),e.restoreVariables=t=>({kind:"restore-variables",variables:t}),e.pushRegionRenames=t=>({kind:"push-region-renames",mapping:t}),e.popRegionRenames=()=>({kind:"pop-region-renames"}),e.pushTemplates=t=>({kind:"push-templates",templates:t}),e.popTemplates=()=>({kind:"pop-templates"})})(_||(_={}));var yt=Symbol.for("yaml.alias"),bt=Symbol.for("yaml.document"),te=Symbol.for("yaml.map"),tn=Symbol.for("yaml.pair"),H=Symbol.for("yaml.scalar"),me=Symbol.for("yaml.seq"),K=Symbol.for("yaml.node.type"),re=e=>!!e&&typeof e=="object"&&e[K]===yt,ge=e=>!!e&&typeof e=="object"&&e[K]===bt,Ie=e=>!!e&&typeof e=="object"&&e[K]===te,O=e=>!!e&&typeof e=="object"&&e[K]===tn,T=e=>!!e&&typeof e=="object"&&e[K]===H,Ne=e=>!!e&&typeof e=="object"&&e[K]===me;function I(e){if(e&&typeof e=="object")switch(e[K]){case te:case me:return!0}return!1}function N(e){if(e&&typeof e=="object")switch(e[K]){case yt:case te:case H:case me:return!0}return!1}var nn=e=>(T(e)||I(e))&&!!e.anchor,B=Symbol("break visit"),sn=Symbol("skip children"),W=Symbol("remove node");function ye(e,t){const n=rn(t);ge(e)?be(null,e.contents,n,Object.freeze([e]))===W&&(e.contents=null):be(null,e,n,Object.freeze([]))}ye.BREAK=B,ye.SKIP=sn,ye.REMOVE=W;function be(e,t,n,i){const s=on(e,t,n,i);if(N(s)||O(s))return an(e,i,s),be(e,s,n,i);if(typeof s!="symbol"){if(I(t)){i=Object.freeze(i.concat(t));for(let o=0;o<t.items.length;++o){const r=be(o,t.items[o],n,i);if(typeof r=="number")o=r-1;else{if(r===B)return B;r===W&&(t.items.splice(o,1),o-=1)}}}else if(O(t)){i=Object.freeze(i.concat(t));const o=be("key",t.key,n,i);if(o===B)return B;o===W&&(t.key=null);const r=be("value",t.value,n,i);if(r===B)return B;r===W&&(t.value=null)}}return s}async function wt(e,t){const n=rn(t);ge(e)?await we(null,e.contents,n,Object.freeze([e]))===W&&(e.contents=null):await we(null,e,n,Object.freeze([]))}wt.BREAK=B,wt.SKIP=sn,wt.REMOVE=W;async function we(e,t,n,i){const s=await on(e,t,n,i);if(N(s)||O(s))return an(e,i,s),we(e,s,n,i);if(typeof s!="symbol"){if(I(t)){i=Object.freeze(i.concat(t));for(let o=0;o<t.items.length;++o){const r=await we(o,t.items[o],n,i);if(typeof r=="number")o=r-1;else{if(r===B)return B;r===W&&(t.items.splice(o,1),o-=1)}}}else if(O(t)){i=Object.freeze(i.concat(t));const o=await we("key",t.key,n,i);if(o===B)return B;o===W&&(t.key=null);const r=await we("value",t.value,n,i);if(r===B)return B;r===W&&(t.value=null)}}return s}function rn(e){return typeof e=="object"&&(e.Collection||e.Node||e.Value)?Object.assign({Alias:e.Node,Map:e.Node,Scalar:e.Node,Seq:e.Node},e.Value&&{Map:e.Value,Scalar:e.Value,Seq:e.Value},e.Collection&&{Map:e.Collection,Seq:e.Collection},e):e}function on(e,t,n,i){if(typeof n=="function")return n(e,t,i);if(Ie(t))return n.Map?.(e,t,i);if(Ne(t))return n.Seq?.(e,t,i);if(O(t))return n.Pair?.(e,t,i);if(T(t))return n.Scalar?.(e,t,i);if(re(t))return n.Alias?.(e,t,i)}function an(e,t,n){const i=t[t.length-1];if(I(i))i.items[e]=n;else if(O(i))e==="key"?i.key=n:i.value=n;else if(ge(i))i.contents=n;else{const s=re(i)?"alias":"scalar";throw new Error(`Cannot replace node with ${s} parent`)}}var _i={"!":"%21",",":"%2C","[":"%5B","]":"%5D","{":"%7B","}":"%7D"},qi=e=>e.replace(/[!,[\]{}]/g,t=>_i[t]),ke=class X{constructor(t,n){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},X.defaultYaml,t),this.tags=Object.assign({},X.defaultTags,n)}clone(){const t=new X(this.yaml,this.tags);return t.docStart=this.docStart,t}atDocument(){const t=new X(this.yaml,this.tags);switch(this.yaml.version){case"1.1":this.atNextDocument=!0;break;case"1.2":this.atNextDocument=!1,this.yaml={explicit:X.defaultYaml.explicit,version:"1.2"},this.tags=Object.assign({},X.defaultTags);break}return t}add(t,n){this.atNextDocument&&(this.yaml={explicit:X.defaultYaml.explicit,version:"1.1"},this.tags=Object.assign({},X.defaultTags),this.atNextDocument=!1);const i=t.trim().split(/[ \t]+/),s=i.shift();switch(s){case"%TAG":{if(i.length!==2&&(n(0,"%TAG directive should contain exactly two parts"),i.length<2))return!1;const[o,r]=i;return this.tags[o]=r,!0}case"%YAML":{if(this.yaml.explicit=!0,i.length!==1)return n(0,"%YAML directive should contain exactly one part"),!1;const[o]=i;if(o==="1.1"||o==="1.2")return this.yaml.version=o,!0;{const r=/^\d+\.\d+$/.test(o);return n(6,`Unsupported YAML version ${o}`,r),!1}}default:return n(0,`Unknown directive ${s}`,!0),!1}}tagName(t,n){if(t==="!")return"!";if(t[0]!=="!")return n(`Not a valid tag: ${t}`),null;if(t[1]==="<"){const r=t.slice(2,-1);return r==="!"||r==="!!"?(n(`Verbatim tags aren't resolved, so ${t} is invalid.`),null):(t[t.length-1]!==">"&&n("Verbatim tags must end with a >"),r)}const[,i,s]=t.match(/^(.*!)([^!]*)$/s);s||n(`The ${t} tag has no suffix`);const o=this.tags[i];if(o)try{return o+decodeURIComponent(s)}catch(r){return n(String(r)),null}return i==="!"?t:(n(`Could not resolve tag: ${t}`),null)}tagString(t){for(const[n,i]of Object.entries(this.tags))if(t.startsWith(i))return n+qi(t.substring(i.length));return t[0]==="!"?t:`!<${t}>`}toString(t){const n=this.yaml.explicit?[`%YAML ${this.yaml.version||"1.2"}`]:[],i=Object.entries(this.tags);let s;if(t&&i.length>0&&N(t.contents)){const o={};ye(t.contents,(r,a)=>{N(a)&&a.tag&&(o[a.tag]=!0)}),s=Object.keys(o)}else s=[];for(const[o,r]of i)o==="!!"&&r==="tag:yaml.org,2002:"||(!t||s.some(a=>a.startsWith(r)))&&n.push(`%TAG ${o} ${r}`);return n.join(`
`)}};ke.defaultYaml={explicit:!1,version:"1.2"},ke.defaultTags={"!!":"tag:yaml.org,2002:"};function cn(e){if(/[\x00-\x19\s,[\]{}]/.test(e)){const n=`Anchor must not contain whitespace or control characters: ${JSON.stringify(e)}`;throw new Error(n)}return!0}function ln(e){const t=new Set;return ye(e,{Value(n,i){i.anchor&&t.add(i.anchor)}}),t}function fn(e,t){for(let n=1;;++n){const i=`${e}${n}`;if(!t.has(i))return i}}function Pi(e,t){const n=[],i=new Map;let s=null;return{onAnchor:o=>{n.push(o),s??(s=ln(e));const r=fn(t,s);return s.add(r),r},setAnchors:()=>{for(const o of n){const r=i.get(o);if(typeof r=="object"&&r.anchor&&(T(r.node)||I(r.node)))r.node.anchor=r.anchor;else{const a=new Error("Failed to resolve repeated object (this should not happen)");throw a.source=o,a}}},sourceObjects:i}}function $e(e,t,n,i){if(i&&typeof i=="object")if(Array.isArray(i))for(let s=0,o=i.length;s<o;++s){const r=i[s],a=$e(e,i,String(s),r);a===void 0?delete i[s]:a!==r&&(i[s]=a)}else if(i instanceof Map)for(const s of Array.from(i.keys())){const o=i.get(s),r=$e(e,i,s,o);r===void 0?i.delete(s):r!==o&&i.set(s,r)}else if(i instanceof Set)for(const s of Array.from(i)){const o=$e(e,i,s,s);o===void 0?i.delete(s):o!==s&&(i.delete(s),i.add(o))}else for(const[s,o]of Object.entries(i)){const r=$e(e,i,s,o);r===void 0?delete i[s]:r!==o&&(i[s]=r)}return e.call(t,n,i)}function U(e,t,n){if(Array.isArray(e))return e.map((i,s)=>U(i,String(s),n));if(e&&typeof e.toJSON=="function"){if(!n||!nn(e))return e.toJSON(t,n);const i={aliasCount:0,count:1,res:void 0};n.anchors.set(e,i),n.onCreate=o=>{i.res=o,delete n.onCreate};const s=e.toJSON(t,n);return n.onCreate&&n.onCreate(s),s}return typeof e=="bigint"&&!n?.keep?Number(e):e}var kt=class{constructor(e){Object.defineProperty(this,K,{value:e})}clone(){const e=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(e.range=this.range.slice()),e}toJS(e,{mapAsMap:t,maxAliasCount:n,onAnchor:i,reviver:s}={}){if(!ge(e))throw new TypeError("A document argument is required");const o={anchors:new Map,doc:e,keep:!0,mapAsMap:t===!0,mapKeyWarned:!1,maxAliasCount:typeof n=="number"?n:100},r=U(this,"",o);if(typeof i=="function")for(const{count:a,res:c}of o.anchors.values())i(c,a);return typeof s=="function"?$e(s,{"":r},"",r):r}},$t=class extends kt{constructor(e){super(yt),this.source=e,Object.defineProperty(this,"tag",{set(){throw new Error("Alias nodes cannot have tags")}})}resolve(e,t){let n;t?.aliasResolveCache?n=t.aliasResolveCache:(n=[],ye(e,{Node:(s,o)=>{(re(o)||nn(o))&&n.push(o)}}),t&&(t.aliasResolveCache=n));let i;for(const s of n){if(s===this)break;s.anchor===this.source&&(i=s)}return i}toJSON(e,t){if(!t)return{source:this.source};const{anchors:n,doc:i,maxAliasCount:s}=t,o=this.resolve(i,t);if(!o){const a=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new ReferenceError(a)}let r=n.get(o);if(r||(U(o,null,t),r=n.get(o)),r?.res===void 0){const a="This should not happen: Alias anchor was not resolved?";throw new ReferenceError(a)}if(s>=0&&(r.count+=1,r.aliasCount===0&&(r.aliasCount=Ve(i,o,n)),r.count*r.aliasCount>s)){const a="Excessive alias count indicates a resource exhaustion attack";throw new ReferenceError(a)}return r.res}toString(e,t,n){const i=`*${this.source}`;if(e){if(cn(this.source),e.options.verifyAliasOrder&&!e.anchors.has(this.source)){const s=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new Error(s)}if(e.implicitKey)return`${i} `}return i}};function Ve(e,t,n){if(re(t)){const i=t.resolve(e),s=n&&i&&n.get(i);return s?s.count*s.aliasCount:0}else if(I(t)){let i=0;for(const s of t.items){const o=Ve(e,s,n);o>i&&(i=o)}return i}else if(O(t)){const i=Ve(e,t.key,n),s=Ve(e,t.value,n);return Math.max(i,s)}return 1}var hn=e=>!e||typeof e!="function"&&typeof e!="object",v=class extends kt{constructor(e){super(H),this.value=e}toJSON(e,t){return t?.keep?this.value:U(this.value,e,t)}toString(){return String(this.value)}};v.BLOCK_FOLDED="BLOCK_FOLDED",v.BLOCK_LITERAL="BLOCK_LITERAL",v.PLAIN="PLAIN",v.QUOTE_DOUBLE="QUOTE_DOUBLE",v.QUOTE_SINGLE="QUOTE_SINGLE";var Ri="tag:yaml.org,2002:";function Bi(e,t,n){if(t){const i=n.filter(o=>o.tag===t),s=i.find(o=>!o.format)??i[0];if(!s)throw new Error(`Tag ${t} not found`);return s}return n.find(i=>i.identify?.(e)&&!i.format)}function Le(e,t,n){if(ge(e)&&(e=e.contents),N(e))return e;if(O(e)){const h=n.schema[te].createNode?.(n.schema,null,n);return h.items.push(e),h}(e instanceof String||e instanceof Number||e instanceof Boolean||typeof BigInt<"u"&&e instanceof BigInt)&&(e=e.valueOf());const{aliasDuplicateObjects:i,onAnchor:s,onTagObj:o,schema:r,sourceObjects:a}=n;let c;if(i&&e&&typeof e=="object"){if(c=a.get(e),c)return c.anchor??(c.anchor=s(e)),new $t(c.anchor);c={anchor:null,node:null},a.set(e,c)}t?.startsWith("!!")&&(t=Ri+t.slice(2));let l=Bi(e,t,r.tags);if(!l){if(e&&typeof e.toJSON=="function"&&(e=e.toJSON()),!e||typeof e!="object"){const h=new v(e);return c&&(c.node=h),h}l=e instanceof Map?r[te]:Symbol.iterator in Object(e)?r[me]:r[te]}o&&(o(l),delete n.onTagObj);const f=l?.createNode?l.createNode(n.schema,e,n):typeof l?.nodeClass?.from=="function"?l.nodeClass.from(n.schema,e,n):new v(e);return t?f.tag=t:l.default||(f.tag=l.tag),c&&(c.node=f),f}function Je(e,t,n){let i=n;for(let s=t.length-1;s>=0;--s){const o=t[s];if(typeof o=="number"&&Number.isInteger(o)&&o>=0){const r=[];r[o]=i,i=r}else i=new Map([[o,i]])}return Le(i,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw new Error("This should not happen, please report a bug.")},schema:e,sourceObjects:new Map})}var Ce=e=>e==null||typeof e=="object"&&!!e[Symbol.iterator]().next().done,dn=class extends kt{constructor(e,t){super(e),Object.defineProperty(this,"schema",{value:t,configurable:!0,enumerable:!1,writable:!0})}clone(e){const t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return e&&(t.schema=e),t.items=t.items.map(n=>N(n)||O(n)?n.clone(e):n),this.range&&(t.range=this.range.slice()),t}addIn(e,t){if(Ce(e))this.add(t);else{const[n,...i]=e,s=this.get(n,!0);if(I(s))s.addIn(i,t);else if(s===void 0&&this.schema)this.set(n,Je(this.schema,i,t));else throw new Error(`Expected YAML collection at ${n}. Remaining path: ${i}`)}}deleteIn(e){const[t,...n]=e;if(n.length===0)return this.delete(t);const i=this.get(t,!0);if(I(i))return i.deleteIn(n);throw new Error(`Expected YAML collection at ${t}. Remaining path: ${n}`)}getIn(e,t){const[n,...i]=e,s=this.get(n,!0);return i.length===0?!t&&T(s)?s.value:s:I(s)?s.getIn(i,t):void 0}hasAllNullValues(e){return this.items.every(t=>{if(!O(t))return!1;const n=t.value;return n==null||e&&T(n)&&n.value==null&&!n.commentBefore&&!n.comment&&!n.tag})}hasIn(e){const[t,...n]=e;if(n.length===0)return this.has(t);const i=this.get(t,!0);return I(i)?i.hasIn(n):!1}setIn(e,t){const[n,...i]=e;if(i.length===0)this.set(n,t);else{const s=this.get(n,!0);if(I(s))s.setIn(i,t);else if(s===void 0&&this.schema)this.set(n,Je(this.schema,i,t));else throw new Error(`Expected YAML collection at ${n}. Remaining path: ${i}`)}}},zi=e=>e.replace(/^(?!$)(?: $)?/gm,"#");function G(e,t){return/^\n+$/.test(e)?e.substring(1):t?e.replace(/^(?! *$)/gm,t):e}var oe=(e,t,n)=>e.endsWith(`
`)?G(n,t):n.includes(`
`)?`
`+G(n,t):(e.endsWith(" ")?"":" ")+n,pn="flow",xt="block",He="quoted";function We(e,t,n="flow",{indentAtStart:i,lineWidth:s=80,minContentWidth:o=20,onFold:r,onOverflow:a}={}){if(!s||s<0)return e;s<o&&(o=0);const c=Math.max(1+o,1+s-t.length);if(e.length<=c)return e;const l=[],f={};let h=s-t.length;typeof i=="number"&&(i>s-Math.max(2,o)?l.push(0):h=s-i);let d,u,g=!1,p=-1,m=-1,b=-1;n===xt&&(p=un(e,p,t.length),p!==-1&&(h=p+c));for(let k;k=e[p+=1];){if(n===He&&k==="\\"){switch(m=p,e[p+1]){case"x":p+=3;break;case"u":p+=5;break;case"U":p+=9;break;default:p+=1}b=p}if(k===`
`)n===xt&&(p=un(e,p,t.length)),h=p+t.length+c,d=void 0;else{if(k===" "&&u&&u!==" "&&u!==`
`&&u!=="	"){const $=e[p+1];$&&$!==" "&&$!==`
`&&$!=="	"&&(d=p)}if(p>=h)if(d)l.push(d),h=d+c,d=void 0;else if(n===He){for(;u===" "||u==="	";)u=k,k=e[p+=1],g=!0;const $=p>b+1?p-2:m-1;if(f[$])return e;l.push($),f[$]=!0,h=$+c,d=void 0}else g=!0}u=k}if(g&&a&&a(),l.length===0)return e;r&&r();let w=e.slice(0,l[0]);for(let k=0;k<l.length;++k){const $=l[k],x=l[k+1]||e.length;$===0?w=`
${t}${e.slice(0,x)}`:(n===He&&f[$]&&(w+=`${e[$]}\\`),w+=`
${t}${e.slice($+1,x)}`)}return w}function un(e,t,n){let i=t,s=t+1,o=e[s];for(;o===" "||o==="	";)if(t<s+n)o=e[++t];else{do o=e[++t];while(o&&o!==`
`);i=t,s=t+1,o=e[s]}return i}var Ge=(e,t)=>({indentAtStart:t?e.indent.length:e.indentAtStart,lineWidth:e.options.lineWidth,minContentWidth:e.options.minContentWidth}),Ye=e=>/^(%|---|\.\.\.)/m.test(e);function Di(e,t,n){if(!t||t<0)return!1;const i=t-n,s=e.length;if(s<=i)return!1;for(let o=0,r=0;o<s;++o)if(e[o]===`
`){if(o-r>i)return!0;if(r=o+1,s-r<=i)return!1}return!0}function _e(e,t){const n=JSON.stringify(e);if(t.options.doubleQuotedAsJSON)return n;const{implicitKey:i}=t,s=t.options.doubleQuotedMinMultiLineLength,o=t.indent||(Ye(e)?"  ":"");let r="",a=0;for(let c=0,l=n[c];l;l=n[++c])if(l===" "&&n[c+1]==="\\"&&n[c+2]==="n"&&(r+=n.slice(a,c)+"\\ ",c+=1,a=c,l="\\"),l==="\\")switch(n[c+1]){case"u":{r+=n.slice(a,c);const f=n.substr(c+2,4);switch(f){case"0000":r+="\\0";break;case"0007":r+="\\a";break;case"000b":r+="\\v";break;case"001b":r+="\\e";break;case"0085":r+="\\N";break;case"00a0":r+="\\_";break;case"2028":r+="\\L";break;case"2029":r+="\\P";break;default:f.substr(0,2)==="00"?r+="\\x"+f.substr(2):r+=n.substr(c,6)}c+=5,a=c+1}break;case"n":if(i||n[c+2]==='"'||n.length<s)c+=1;else{for(r+=n.slice(a,c)+`

`;n[c+2]==="\\"&&n[c+3]==="n"&&n[c+4]!=='"';)r+=`
`,c+=2;r+=o,n[c+2]===" "&&(r+="\\"),c+=1,a=c+1}break;default:c+=1}return r=a?r+n.slice(a):n,i?r:We(r,o,He,Ge(t,!1))}function vt(e,t){if(t.options.singleQuote===!1||t.implicitKey&&e.includes(`
`)||/[ \t]\n|\n[ \t]/.test(e))return _e(e,t);const n=t.indent||(Ye(e)?"  ":""),i="'"+e.replace(/'/g,"''").replace(/\n+/g,`$&
${n}`)+"'";return t.implicitKey?i:We(i,n,pn,Ge(t,!1))}function xe(e,t){const{singleQuote:n}=t.options;let i;if(n===!1)i=_e;else{const s=e.includes('"'),o=e.includes("'");s&&!o?i=vt:o&&!s?i=_e:i=n?vt:_e}return i(e,t)}var At;try{At=new RegExp(`(^|(?<!
))
+(?!
|$)`,"g")}catch{At=/\n+(?!\n|$)/g}function Qe({comment:e,type:t,value:n},i,s,o){const{blockQuote:r,commentString:a,lineWidth:c}=i.options;if(!r||/\n[\t ]+$/.test(n))return xe(n,i);const l=i.indent||(i.forceBlockIndent||Ye(n)?"  ":""),f=r==="literal"?!0:r==="folded"||t===v.BLOCK_FOLDED?!1:t===v.BLOCK_LITERAL?!0:!Di(n,c,l.length);if(!n)return f?`|
`:`>
`;let h,d;for(d=n.length;d>0;--d){const x=n[d-1];if(x!==`
`&&x!=="	"&&x!==" ")break}let u=n.substring(d);const g=u.indexOf(`
`);g===-1?h="-":n===u||g!==u.length-1?(h="+",o&&o()):h="",u&&(n=n.slice(0,-u.length),u[u.length-1]===`
`&&(u=u.slice(0,-1)),u=u.replace(At,`$&${l}`));let p=!1,m,b=-1;for(m=0;m<n.length;++m){const x=n[m];if(x===" ")p=!0;else if(x===`
`)b=m;else break}let w=n.substring(0,b<m?b+1:m);w&&(n=n.substring(w.length),w=w.replace(/\n+/g,`$&${l}`));let $=(p?l?"2":"1":"")+h;if(e&&($+=" "+a(e.replace(/ ?[\r\n]+/g," ")),s&&s()),!f){const x=n.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,"$1$2").replace(/\n+/g,`$&${l}`);let A=!1;const j=Ge(i,!0);r!=="folded"&&t!==v.BLOCK_FOLDED&&(j.onOverflow=()=>{A=!0});const y=We(`${w}${x}${u}`,l,xt,j);if(!A)return`>${$}
${l}${y}`}return n=n.replace(/\n+/g,`$&${l}`),`|${$}
${l}${w}${n}${u}`}function Mi(e,t,n,i){const{type:s,value:o}=e,{actualString:r,implicitKey:a,indent:c,indentStep:l,inFlow:f}=t;if(a&&o.includes(`
`)||f&&/[[\]{},]/.test(o))return xe(o,t);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(o))return a||f||!o.includes(`
`)?xe(o,t):Qe(e,t,n,i);if(!a&&!f&&s!==v.PLAIN&&o.includes(`
`))return Qe(e,t,n,i);if(Ye(o)){if(c==="")return t.forceBlockIndent=!0,Qe(e,t,n,i);if(a&&c===l)return xe(o,t)}const h=o.replace(/\n+/g,`$&
${c}`);if(r){const d=p=>p.default&&p.tag!=="tag:yaml.org,2002:str"&&p.test?.test(h),{compat:u,tags:g}=t.doc.schema;if(g.some(d)||u?.some(d))return xe(o,t)}return a?h:We(h,c,pn,Ge(t,!1))}function St(e,t,n,i){const{implicitKey:s,inFlow:o}=t,r=typeof e.value=="string"?e:Object.assign({},e,{value:String(e.value)});let{type:a}=e;a!==v.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(r.value)&&(a=v.QUOTE_DOUBLE);const c=f=>{switch(f){case v.BLOCK_FOLDED:case v.BLOCK_LITERAL:return s||o?xe(r.value,t):Qe(r,t,n,i);case v.QUOTE_DOUBLE:return _e(r.value,t);case v.QUOTE_SINGLE:return vt(r.value,t);case v.PLAIN:return Mi(r,t,n,i);default:return null}};let l=c(a);if(l===null){const{defaultKeyType:f,defaultStringType:h}=t.options,d=s&&f||h;if(l=c(d),l===null)throw new Error(`Unsupported default string type ${d}`)}return l}function mn(e,t){const n=Object.assign({blockQuote:!0,commentString:zi,defaultKeyType:null,defaultStringType:"PLAIN",directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:"false",flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:"null",simpleKeys:!1,singleQuote:null,trueStr:"true",verifyAliasOrder:!0},e.schema.toStringOptions,t);let i;switch(n.collectionStyle){case"block":i=!1;break;case"flow":i=!0;break;default:i=null}return{anchors:new Set,doc:e,flowCollectionPadding:n.flowCollectionPadding?" ":"",indent:"",indentStep:typeof n.indent=="number"?" ".repeat(n.indent):"  ",inFlow:i,options:n}}function Ki(e,t){if(t.tag){const s=e.filter(o=>o.tag===t.tag);if(s.length>0)return s.find(o=>o.format===t.format)??s[0]}let n,i;if(T(t)){i=t.value;let s=e.filter(o=>o.identify?.(i));if(s.length>1){const o=s.filter(r=>r.test);o.length>0&&(s=o)}n=s.find(o=>o.format===t.format)??s.find(o=>!o.format)}else i=t,n=e.find(s=>s.nodeClass&&i instanceof s.nodeClass);if(!n){const s=i?.constructor?.name??(i===null?"null":typeof i);throw new Error(`Tag not resolved for ${s} value`)}return n}function Ui(e,t,{anchors:n,doc:i}){if(!i.directives)return"";const s=[],o=(T(e)||I(e))&&e.anchor;o&&cn(o)&&(n.add(o),s.push(`&${o}`));const r=e.tag??(t.default?null:t.tag);return r&&s.push(i.directives.tagString(r)),s.join(" ")}function ve(e,t,n,i){if(O(e))return e.toString(t,n,i);if(re(e)){if(t.doc.directives)return e.toString(t);if(t.resolvedAliases?.has(e))throw new TypeError("Cannot stringify circular structure without alias nodes");t.resolvedAliases?t.resolvedAliases.add(e):t.resolvedAliases=new Set([e]),e=e.resolve(t.doc)}let s;const o=N(e)?e:t.doc.createNode(e,{onTagObj:c=>s=c});s??(s=Ki(t.doc.schema.tags,o));const r=Ui(o,s,t);r.length>0&&(t.indentAtStart=(t.indentAtStart??0)+r.length+1);const a=typeof s.stringify=="function"?s.stringify(o,t,n,i):T(o)?St(o,t,n,i):o.toString(t,n,i);return r?T(o)||a[0]==="{"||a[0]==="["?`${r} ${a}`:`${r}
${t.indent}${a}`:a}function Fi({key:e,value:t},n,i,s){const{allNullValues:o,doc:r,indent:a,indentStep:c,options:{commentString:l,indentSeq:f,simpleKeys:h}}=n;let d=N(e)&&e.comment||null;if(h){if(d)throw new Error("With simple keys, key nodes cannot have comments");if(I(e)||!N(e)&&typeof e=="object"){const j="With simple keys, collection cannot be used as a key value";throw new Error(j)}}let u=!h&&(!e||d&&t==null&&!n.inFlow||I(e)||(T(e)?e.type===v.BLOCK_FOLDED||e.type===v.BLOCK_LITERAL:typeof e=="object"));n=Object.assign({},n,{allNullValues:!1,implicitKey:!u&&(h||!o),indent:a+c});let g=!1,p=!1,m=ve(e,n,()=>g=!0,()=>p=!0);if(!u&&!n.inFlow&&m.length>1024){if(h)throw new Error("With simple keys, single line scalar must not span more than 1024 characters");u=!0}if(n.inFlow){if(o||t==null)return g&&i&&i(),m===""?"?":u?`? ${m}`:m}else if(o&&!h||t==null&&u)return m=`? ${m}`,d&&!g?m+=oe(m,n.indent,l(d)):p&&s&&s(),m;g&&(d=null),u?(d&&(m+=oe(m,n.indent,l(d))),m=`? ${m}
${a}:`):(m=`${m}:`,d&&(m+=oe(m,n.indent,l(d))));let b,w,k;N(t)?(b=!!t.spaceBefore,w=t.commentBefore,k=t.comment):(b=!1,w=null,k=null,t&&typeof t=="object"&&(t=r.createNode(t))),n.implicitKey=!1,!u&&!d&&T(t)&&(n.indentAtStart=m.length+1),p=!1,!f&&c.length>=2&&!n.inFlow&&!u&&Ne(t)&&!t.flow&&!t.tag&&!t.anchor&&(n.indent=n.indent.substring(2));let $=!1;const x=ve(t,n,()=>$=!0,()=>p=!0);let A=" ";if(d||b||w){if(A=b?`
`:"",w){const j=l(w);A+=`
${G(j,n.indent)}`}x===""&&!n.inFlow?A===`
`&&k&&(A=`

`):A+=`
${n.indent}`}else if(!u&&I(t)){const j=x[0],y=x.indexOf(`
`),L=y!==-1,ee=n.inFlow??t.flow??t.items.length===0;if(L||!ee){let ue=!1;if(L&&(j==="&"||j==="!")){let C=x.indexOf(" ");j==="&"&&C!==-1&&C<y&&x[C+1]==="!"&&(C=x.indexOf(" ",C+1)),(C===-1||y<C)&&(ue=!0)}ue||(A=`
${n.indent}`)}}else(x===""||x[0]===`
`)&&(A="");return m+=A+x,n.inFlow?$&&i&&i():k&&!$?m+=oe(m,n.indent,l(k)):p&&s&&s(),m}function gn(e,t){(e==="debug"||e==="warn")&&console.warn(t)}var Xe="<<",Y={identify:e=>e===Xe||typeof e=="symbol"&&e.description===Xe,default:"key",tag:"tag:yaml.org,2002:merge",test:/^<<$/,resolve:()=>Object.assign(new v(Symbol(Xe)),{addToJSMap:yn}),stringify:()=>Xe},Vi=(e,t)=>(Y.identify(t)||T(t)&&(!t.type||t.type===v.PLAIN)&&Y.identify(t.value))&&e?.doc.schema.tags.some(n=>n.tag===Y.tag&&n.default);function yn(e,t,n){if(n=e&&re(n)?n.resolve(e.doc):n,Ne(n))for(const i of n.items)jt(e,t,i);else if(Array.isArray(n))for(const i of n)jt(e,t,i);else jt(e,t,n)}function jt(e,t,n){const i=e&&re(n)?n.resolve(e.doc):n;if(!Ie(i))throw new Error("Merge sources must be maps or map aliases");const s=i.toJSON(null,e,Map);for(const[o,r]of s)t instanceof Map?t.has(o)||t.set(o,r):t instanceof Set?t.add(o):Object.prototype.hasOwnProperty.call(t,o)||Object.defineProperty(t,o,{value:r,writable:!0,enumerable:!0,configurable:!0});return t}function bn(e,t,{key:n,value:i}){if(N(n)&&n.addToJSMap)n.addToJSMap(e,t,i);else if(Vi(e,n))yn(e,t,i);else{const s=U(n,"",e);if(t instanceof Map)t.set(s,U(i,s,e));else if(t instanceof Set)t.add(s);else{const o=Ji(n,s,e),r=U(i,o,e);o in t?Object.defineProperty(t,o,{value:r,writable:!0,enumerable:!0,configurable:!0}):t[o]=r}}return t}function Ji(e,t,n){if(t===null)return"";if(typeof t!="object")return String(t);if(N(e)&&n?.doc){const i=mn(n.doc,{});i.anchors=new Set;for(const o of n.anchors.keys())i.anchors.add(o.anchor);i.inFlow=!0,i.inStringifyKey=!0;const s=e.toString(i);if(!n.mapKeyWarned){let o=JSON.stringify(s);o.length>40&&(o=o.substring(0,36)+'..."'),gn(n.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${o}. Set mapAsMap: true to use object keys.`),n.mapKeyWarned=!0}return s}return JSON.stringify(t)}function Tt(e,t,n){const i=Le(e,void 0,n),s=Le(t,void 0,n);return new M(i,s)}var M=class ji{constructor(t,n=null){Object.defineProperty(this,K,{value:tn}),this.key=t,this.value=n}clone(t){let{key:n,value:i}=this;return N(n)&&(n=n.clone(t)),N(i)&&(i=i.clone(t)),new ji(n,i)}toJSON(t,n){const i=n?.mapAsMap?new Map:{};return bn(n,i,this)}toString(t,n,i){return t?.doc?Fi(this,t,n,i):JSON.stringify(this)}};function wn(e,t,n){return(t.inFlow??e.flow?Wi:Hi)(e,t,n)}function Hi({comment:e,items:t},n,{blockItemPrefix:i,flowChars:s,itemIndent:o,onChompKeep:r,onComment:a}){const{indent:c,options:{commentString:l}}=n,f=Object.assign({},n,{indent:o,type:null});let h=!1;const d=[];for(let g=0;g<t.length;++g){const p=t[g];let m=null;if(N(p))!h&&p.spaceBefore&&d.push(""),Ze(n,d,p.commentBefore,h),p.comment&&(m=p.comment);else if(O(p)){const w=N(p.key)?p.key:null;w&&(!h&&w.spaceBefore&&d.push(""),Ze(n,d,w.commentBefore,h))}h=!1;let b=ve(p,f,()=>m=null,()=>h=!0);m&&(b+=oe(b,o,l(m))),h&&m&&(h=!1),d.push(i+b)}let u;if(d.length===0)u=s.start+s.end;else{u=d[0];for(let g=1;g<d.length;++g){const p=d[g];u+=p?`
${c}${p}`:`
`}}return e?(u+=`
`+G(l(e),c),a&&a()):h&&r&&r(),u}function Wi({items:e},t,{flowChars:n,itemIndent:i}){const{indent:s,indentStep:o,flowCollectionPadding:r,options:{commentString:a}}=t;i+=o;const c=Object.assign({},t,{indent:i,inFlow:!0,type:null});let l=!1,f=0;const h=[];for(let g=0;g<e.length;++g){const p=e[g];let m=null;if(N(p))p.spaceBefore&&h.push(""),Ze(t,h,p.commentBefore,!1),p.comment&&(m=p.comment);else if(O(p)){const w=N(p.key)?p.key:null;w&&(w.spaceBefore&&h.push(""),Ze(t,h,w.commentBefore,!1),w.comment&&(l=!0));const k=N(p.value)?p.value:null;k?(k.comment&&(m=k.comment),k.commentBefore&&(l=!0)):p.value==null&&w?.comment&&(m=w.comment)}m&&(l=!0);let b=ve(p,c,()=>m=null);g<e.length-1&&(b+=","),m&&(b+=oe(b,i,a(m))),!l&&(h.length>f||b.includes(`
`))&&(l=!0),h.push(b),f=h.length}const{start:d,end:u}=n;if(h.length===0)return d+u;if(!l){const g=h.reduce((p,m)=>p+m.length+2,2);l=t.options.lineWidth>0&&g>t.options.lineWidth}if(l){let g=d;for(const p of h)g+=p?`
${o}${s}${p}`:`
`;return`${g}
${s}${u}`}else return`${d}${r}${h.join(" ")}${r}${u}`}function Ze({indent:e,options:{commentString:t}},n,i,s){if(i&&s&&(i=i.replace(/^\n+/,"")),i){const o=G(t(i),e);n.push(o.trimStart())}}function ae(e,t){const n=T(t)?t.value:t;for(const i of e)if(O(i)&&(i.key===t||i.key===n||T(i.key)&&i.key.value===n))return i}var F=class extends dn{static get tagName(){return"tag:yaml.org,2002:map"}constructor(e){super(te,e),this.items=[]}static from(e,t,n){const{keepUndefined:i,replacer:s}=n,o=new this(e),r=(a,c)=>{if(typeof s=="function")c=s.call(t,a,c);else if(Array.isArray(s)&&!s.includes(a))return;(c!==void 0||i)&&o.items.push(Tt(a,c,n))};if(t instanceof Map)for(const[a,c]of t)r(a,c);else if(t&&typeof t=="object")for(const a of Object.keys(t))r(a,t[a]);return typeof e.sortMapEntries=="function"&&o.items.sort(e.sortMapEntries),o}add(e,t){let n;O(e)?n=e:!e||typeof e!="object"||!("key"in e)?n=new M(e,e?.value):n=new M(e.key,e.value);const i=ae(this.items,n.key),s=this.schema?.sortMapEntries;if(i){if(!t)throw new Error(`Key ${n.key} already set`);T(i.value)&&hn(n.value)?i.value.value=n.value:i.value=n.value}else if(s){const o=this.items.findIndex(r=>s(n,r)<0);o===-1?this.items.push(n):this.items.splice(o,0,n)}else this.items.push(n)}delete(e){const t=ae(this.items,e);return t?this.items.splice(this.items.indexOf(t),1).length>0:!1}get(e,t){const i=ae(this.items,e)?.value;return(!t&&T(i)?i.value:i)??void 0}has(e){return!!ae(this.items,e)}set(e,t){this.add(new M(e,t),!0)}toJSON(e,t,n){const i=n?new n:t?.mapAsMap?new Map:{};t?.onCreate&&t.onCreate(i);for(const s of this.items)bn(t,i,s);return i}toString(e,t,n){if(!e)return JSON.stringify(this);for(const i of this.items)if(!O(i))throw new Error(`Map items must all be pairs; found ${JSON.stringify(i)} instead`);return!e.allNullValues&&this.hasAllNullValues(!1)&&(e=Object.assign({},e,{allNullValues:!0})),wn(this,e,{blockItemPrefix:"",flowChars:{start:"{",end:"}"},itemIndent:e.indent||"",onChompKeep:n,onComment:t})}},Ae={collection:"map",default:!0,nodeClass:F,tag:"tag:yaml.org,2002:map",resolve(e,t){return Ie(e)||t("Expected a mapping for this tag"),e},createNode:(e,t,n)=>F.from(e,t,n)},ce=class extends dn{static get tagName(){return"tag:yaml.org,2002:seq"}constructor(e){super(me,e),this.items=[]}add(e){this.items.push(e)}delete(e){const t=et(e);return typeof t!="number"?!1:this.items.splice(t,1).length>0}get(e,t){const n=et(e);if(typeof n!="number")return;const i=this.items[n];return!t&&T(i)?i.value:i}has(e){const t=et(e);return typeof t=="number"&&t<this.items.length}set(e,t){const n=et(e);if(typeof n!="number")throw new Error(`Expected a valid index, not ${e}.`);const i=this.items[n];T(i)&&hn(t)?i.value=t:this.items[n]=t}toJSON(e,t){const n=[];t?.onCreate&&t.onCreate(n);let i=0;for(const s of this.items)n.push(U(s,String(i++),t));return n}toString(e,t,n){return e?wn(this,e,{blockItemPrefix:"- ",flowChars:{start:"[",end:"]"},itemIndent:(e.indent||"")+"  ",onChompKeep:n,onComment:t}):JSON.stringify(this)}static from(e,t,n){const{replacer:i}=n,s=new this(e);if(t&&Symbol.iterator in Object(t)){let o=0;for(let r of t){if(typeof i=="function"){const a=t instanceof Set?r:String(o++);r=i.call(t,a,r)}s.items.push(Le(r,void 0,n))}}return s}};function et(e){let t=T(e)?e.value:e;return t&&typeof t=="string"&&(t=Number(t)),typeof t=="number"&&Number.isInteger(t)&&t>=0?t:null}var Se={collection:"seq",default:!0,nodeClass:ce,tag:"tag:yaml.org,2002:seq",resolve(e,t){return Ne(e)||t("Expected a sequence for this tag"),e},createNode:(e,t,n)=>ce.from(e,t,n)},tt={identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify(e,t,n,i){return t=Object.assign({actualString:!0},t),St(e,t,n,i)}},nt={identify:e=>e==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new v(null),stringify:({source:e},t)=>typeof e=="string"&&nt.test.test(e)?e:t.options.nullStr},Ot={identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:e=>new v(e[0]==="t"||e[0]==="T"),stringify({source:e,value:t},n){if(e&&Ot.test.test(e)){const i=e[0]==="t"||e[0]==="T";if(t===i)return e}return t?n.options.trueStr:n.options.falseStr}};function V({format:e,minFractionDigits:t,tag:n,value:i}){if(typeof i=="bigint")return String(i);const s=typeof i=="number"?i:Number(i);if(!isFinite(s))return isNaN(s)?".nan":s<0?"-.inf":".inf";let o=Object.is(i,-0)?"-0":JSON.stringify(i);if(!e&&t&&(!n||n==="tag:yaml.org,2002:float")&&/^\d/.test(o)){let r=o.indexOf(".");r<0&&(r=o.length,o+=".");let a=t-(o.length-r-1);for(;a-- >0;)o+="0"}return o}var kn={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:V},$n={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():V(e)}},xn={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(e){const t=new v(parseFloat(e)),n=e.indexOf(".");return n!==-1&&e[e.length-1]==="0"&&(t.minFractionDigits=e.length-n-1),t},stringify:V},it=e=>typeof e=="bigint"||Number.isInteger(e),Et=(e,t,n,{intAsBigInt:i})=>i?BigInt(e):parseInt(e.substring(t),n);function vn(e,t,n){const{value:i}=e;return it(i)&&i>=0?n+i.toString(t):V(e)}var An={identify:e=>it(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^0o[0-7]+$/,resolve:(e,t,n)=>Et(e,2,8,n),stringify:e=>vn(e,8,"0o")},Sn={identify:it,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9]+$/,resolve:(e,t,n)=>Et(e,0,10,n),stringify:V},jn={identify:e=>it(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^0x[0-9a-fA-F]+$/,resolve:(e,t,n)=>Et(e,2,16,n),stringify:e=>vn(e,16,"0x")},Gi=[Ae,Se,tt,nt,Ot,An,Sn,jn,kn,$n,xn];function Tn(e){return typeof e=="bigint"||Number.isInteger(e)}var st=({value:e})=>JSON.stringify(e),Yi=[{identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify:st},{identify:e=>e==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^null$/,resolve:()=>null,stringify:st},{identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^true$|^false$/,resolve:e=>e==="true",stringify:st},{identify:Tn,default:!0,tag:"tag:yaml.org,2002:int",test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(e,t,{intAsBigInt:n})=>n?BigInt(e):parseInt(e,10),stringify:({value:e})=>Tn(e)?e.toString():JSON.stringify(e)},{identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:e=>parseFloat(e),stringify:st}],Qi={default:!0,tag:"",test:/^/,resolve(e,t){return t(`Unresolved plain scalar ${JSON.stringify(e)}`),e}},Xi=[Ae,Se].concat(Yi,Qi),It={identify:e=>e instanceof Uint8Array,default:!1,tag:"tag:yaml.org,2002:binary",resolve(e,t){if(typeof atob=="function"){const n=atob(e.replace(/[\n\r]/g,"")),i=new Uint8Array(n.length);for(let s=0;s<n.length;++s)i[s]=n.charCodeAt(s);return i}else return t("This environment does not support reading binary tags; either Buffer or atob is required"),e},stringify({comment:e,type:t,value:n},i,s,o){if(!n)return"";const r=n;let a;if(typeof btoa=="function"){let c="";for(let l=0;l<r.length;++l)c+=String.fromCharCode(r[l]);a=btoa(c)}else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");if(t??(t=v.BLOCK_LITERAL),t!==v.QUOTE_DOUBLE){const c=Math.max(i.options.lineWidth-i.indent.length,i.options.minContentWidth),l=Math.ceil(a.length/c),f=new Array(l);for(let h=0,d=0;h<l;++h,d+=c)f[h]=a.substr(d,c);a=f.join(t===v.BLOCK_LITERAL?`
`:" ")}return St({comment:e,type:t,value:a},i,s,o)}};function On(e,t){if(Ne(e))for(let n=0;n<e.items.length;++n){let i=e.items[n];if(!O(i)){if(Ie(i)){i.items.length>1&&t("Each pair must have its own sequence indicator");const s=i.items[0]||new M(new v(null));if(i.commentBefore&&(s.key.commentBefore=s.key.commentBefore?`${i.commentBefore}
${s.key.commentBefore}`:i.commentBefore),i.comment){const o=s.value??s.key;o.comment=o.comment?`${i.comment}
${o.comment}`:i.comment}i=s}e.items[n]=O(i)?i:new M(i)}}else t("Expected a sequence for this tag");return e}function En(e,t,n){const{replacer:i}=n,s=new ce(e);s.tag="tag:yaml.org,2002:pairs";let o=0;if(t&&Symbol.iterator in Object(t))for(let r of t){typeof i=="function"&&(r=i.call(t,String(o++),r));let a,c;if(Array.isArray(r))if(r.length===2)a=r[0],c=r[1];else throw new TypeError(`Expected [key, value] tuple: ${r}`);else if(r&&r instanceof Object){const l=Object.keys(r);if(l.length===1)a=l[0],c=r[a];else throw new TypeError(`Expected tuple with one key, not ${l.length} keys`)}else a=r;s.items.push(Tt(a,c,n))}return s}var Nt={collection:"seq",default:!1,tag:"tag:yaml.org,2002:pairs",resolve:On,createNode:En},rt=class Ti extends ce{constructor(){super(),this.add=F.prototype.add.bind(this),this.delete=F.prototype.delete.bind(this),this.get=F.prototype.get.bind(this),this.has=F.prototype.has.bind(this),this.set=F.prototype.set.bind(this),this.tag=Ti.tag}toJSON(t,n){if(!n)return super.toJSON(t);const i=new Map;n?.onCreate&&n.onCreate(i);for(const s of this.items){let o,r;if(O(s)?(o=U(s.key,"",n),r=U(s.value,o,n)):o=U(s,"",n),i.has(o))throw new Error("Ordered maps must not include duplicate keys");i.set(o,r)}return i}static from(t,n,i){const s=En(t,n,i),o=new this;return o.items=s.items,o}};rt.tag="tag:yaml.org,2002:omap";var Lt={collection:"seq",identify:e=>e instanceof Map,nodeClass:rt,default:!1,tag:"tag:yaml.org,2002:omap",resolve(e,t){const n=On(e,t),i=[];for(const{key:s}of n.items)T(s)&&(i.includes(s.value)?t(`Ordered maps must not include duplicate keys: ${s.value}`):i.push(s.value));return Object.assign(new rt,n)},createNode:(e,t,n)=>rt.from(e,t,n)};function In({value:e,source:t},n){return t&&(e?Nn:Ln).test.test(t)?t:e?n.options.trueStr:n.options.falseStr}var Nn={identify:e=>e===!0,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new v(!0),stringify:In},Ln={identify:e=>e===!1,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new v(!1),stringify:In},Zi={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:V},es={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e.replace(/_/g,"")),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():V(e)}},ts={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(e){const t=new v(parseFloat(e.replace(/_/g,""))),n=e.indexOf(".");if(n!==-1){const i=e.substring(n+1).replace(/_/g,"");i[i.length-1]==="0"&&(t.minFractionDigits=i.length)}return t},stringify:V},qe=e=>typeof e=="bigint"||Number.isInteger(e);function ot(e,t,n,{intAsBigInt:i}){const s=e[0];if((s==="-"||s==="+")&&(t+=1),e=e.substring(t).replace(/_/g,""),i){switch(n){case 2:e=`0b${e}`;break;case 8:e=`0o${e}`;break;case 16:e=`0x${e}`;break}const r=BigInt(e);return s==="-"?BigInt(-1)*r:r}const o=parseInt(e,n);return s==="-"?-1*o:o}function Ct(e,t,n){const{value:i}=e;if(qe(i)){const s=i.toString(t);return i<0?"-"+n+s.substr(1):n+s}return V(e)}var ns={identify:qe,default:!0,tag:"tag:yaml.org,2002:int",format:"BIN",test:/^[-+]?0b[0-1_]+$/,resolve:(e,t,n)=>ot(e,2,2,n),stringify:e=>Ct(e,2,"0b")},is={identify:qe,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^[-+]?0[0-7_]+$/,resolve:(e,t,n)=>ot(e,1,8,n),stringify:e=>Ct(e,8,"0")},ss={identify:qe,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9][0-9_]*$/,resolve:(e,t,n)=>ot(e,0,10,n),stringify:V},rs={identify:qe,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(e,t,n)=>ot(e,2,16,n),stringify:e=>Ct(e,16,"0x")},at=class Oi extends F{constructor(t){super(t),this.tag=Oi.tag}add(t){let n;O(t)?n=t:t&&typeof t=="object"&&"key"in t&&"value"in t&&t.value===null?n=new M(t.key,null):n=new M(t,null),ae(this.items,n.key)||this.items.push(n)}get(t,n){const i=ae(this.items,t);return!n&&O(i)?T(i.key)?i.key.value:i.key:i}set(t,n){if(typeof n!="boolean")throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof n}`);const i=ae(this.items,t);i&&!n?this.items.splice(this.items.indexOf(i),1):!i&&n&&this.items.push(new M(t))}toJSON(t,n){return super.toJSON(t,n,Set)}toString(t,n,i){if(!t)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},t,{allNullValues:!0}),n,i);throw new Error("Set items must all have null values")}static from(t,n,i){const{replacer:s}=i,o=new this(t);if(n&&Symbol.iterator in Object(n))for(let r of n)typeof s=="function"&&(r=s.call(n,r,r)),o.items.push(Tt(r,null,i));return o}};at.tag="tag:yaml.org,2002:set";var _t={collection:"map",identify:e=>e instanceof Set,nodeClass:at,default:!1,tag:"tag:yaml.org,2002:set",createNode:(e,t,n)=>at.from(e,t,n),resolve(e,t){if(Ie(e)){if(e.hasAllNullValues(!0))return Object.assign(new at,e);t("Set items must all have null values")}else t("Expected a mapping for this tag");return e}};function qt(e,t){const n=e[0],i=n==="-"||n==="+"?e.substring(1):e,s=r=>t?BigInt(r):Number(r),o=i.replace(/_/g,"").split(":").reduce((r,a)=>r*s(60)+s(a),s(0));return n==="-"?s(-1)*o:o}function Cn(e){let{value:t}=e,n=r=>r;if(typeof t=="bigint")n=r=>BigInt(r);else if(isNaN(t)||!isFinite(t))return V(e);let i="";t<0&&(i="-",t*=n(-1));const s=n(60),o=[t%s];return t<60?o.unshift(0):(t=(t-o[0])/s,o.unshift(t%s),t>=60&&(t=(t-o[0])/s,o.unshift(t))),i+o.map(r=>String(r).padStart(2,"0")).join(":").replace(/000000\d*$/,"")}var _n={identify:e=>typeof e=="bigint"||Number.isInteger(e),default:!0,tag:"tag:yaml.org,2002:int",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(e,t,{intAsBigInt:n})=>qt(e,n),stringify:Cn},qn={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:e=>qt(e,!1),stringify:Cn},ct={identify:e=>e instanceof Date,default:!0,tag:"tag:yaml.org,2002:timestamp",test:RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),resolve(e){const t=e.match(ct.test);if(!t)throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");const[,n,i,s,o,r,a]=t.map(Number),c=t[7]?Number((t[7]+"00").substr(1,3)):0;let l=Date.UTC(n,i-1,s,o||0,r||0,a||0,c);const f=t[8];if(f&&f!=="Z"){let h=qt(f,!1);Math.abs(h)<30&&(h*=60),l-=6e4*h}return new Date(l)},stringify:({value:e})=>e?.toISOString().replace(/(T00:00:00)?\.000Z$/,"")??""},Pn=[Ae,Se,tt,nt,Nn,Ln,ns,is,ss,rs,Zi,es,ts,It,Y,Lt,Nt,_t,_n,qn,ct],Rn=new Map([["core",Gi],["failsafe",[Ae,Se,tt]],["json",Xi],["yaml11",Pn],["yaml-1.1",Pn]]),Bn={binary:It,bool:Ot,float:xn,floatExp:$n,floatNaN:kn,floatTime:qn,int:Sn,intHex:jn,intOct:An,intTime:_n,map:Ae,merge:Y,null:nt,omap:Lt,pairs:Nt,seq:Se,set:_t,timestamp:ct},os={"tag:yaml.org,2002:binary":It,"tag:yaml.org,2002:merge":Y,"tag:yaml.org,2002:omap":Lt,"tag:yaml.org,2002:pairs":Nt,"tag:yaml.org,2002:set":_t,"tag:yaml.org,2002:timestamp":ct};function Pt(e,t,n){const i=Rn.get(t);if(i&&!e)return n&&!i.includes(Y)?i.concat(Y):i.slice();let s=i;if(!s)if(Array.isArray(e))s=[];else{const o=Array.from(Rn.keys()).filter(r=>r!=="yaml11").map(r=>JSON.stringify(r)).join(", ");throw new Error(`Unknown schema "${t}"; use one of ${o} or define customTags array`)}if(Array.isArray(e))for(const o of e)s=s.concat(o);else typeof e=="function"&&(s=e(s.slice()));return n&&(s=s.concat(Y)),s.reduce((o,r)=>{const a=typeof r=="string"?Bn[r]:r;if(!a){const c=JSON.stringify(r),l=Object.keys(Bn).map(f=>JSON.stringify(f)).join(", ");throw new Error(`Unknown custom tag ${c}; use one of ${l}`)}return o.includes(a)||o.push(a),o},[])}var as=(e,t)=>e.key<t.key?-1:e.key>t.key?1:0,cs=class Ei{constructor({compat:t,customTags:n,merge:i,resolveKnownTags:s,schema:o,sortMapEntries:r,toStringDefaults:a}){this.compat=Array.isArray(t)?Pt(t,"compat"):t?Pt(null,t):null,this.name=typeof o=="string"&&o||"core",this.knownTags=s?os:{},this.tags=Pt(n,this.name,i),this.toStringOptions=a??null,Object.defineProperty(this,te,{value:Ae}),Object.defineProperty(this,H,{value:tt}),Object.defineProperty(this,me,{value:Se}),this.sortMapEntries=typeof r=="function"?r:r===!0?as:null}clone(){const t=Object.create(Ei.prototype,Object.getOwnPropertyDescriptors(this));return t.tags=this.tags.slice(),t}};function ls(e,t){const n=[];let i=t.directives===!0;if(t.directives!==!1&&e.directives){const c=e.directives.toString(e);c?(n.push(c),i=!0):e.directives.docStart&&(i=!0)}i&&n.push("---");const s=mn(e,t),{commentString:o}=s.options;if(e.commentBefore){n.length!==1&&n.unshift("");const c=o(e.commentBefore);n.unshift(G(c,""))}let r=!1,a=null;if(e.contents){if(N(e.contents)){if(e.contents.spaceBefore&&i&&n.push(""),e.contents.commentBefore){const f=o(e.contents.commentBefore);n.push(G(f,""))}s.forceBlockIndent=!!e.comment,a=e.contents.comment}const c=a?void 0:()=>r=!0;let l=ve(e.contents,s,()=>a=null,c);a&&(l+=oe(l,"",o(a))),(l[0]==="|"||l[0]===">")&&n[n.length-1]==="---"?n[n.length-1]=`--- ${l}`:n.push(l)}else n.push(ve(e.contents,s));if(e.directives?.docEnd)if(e.comment){const c=o(e.comment);c.includes(`
`)?(n.push("..."),n.push(G(c,""))):n.push(`... ${c}`)}else n.push("...");else{let c=e.comment;c&&r&&(c=c.replace(/^\n+/,"")),c&&((!r||a)&&n[n.length-1]!==""&&n.push(""),n.push(G(o(c),"")))}return n.join(`
`)+`
`}var Rt=class Ii{constructor(t,n,i){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,K,{value:bt});let s=null;typeof n=="function"||Array.isArray(n)?s=n:i===void 0&&n&&(i=n,n=void 0);const o=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:"warn",prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:"1.2"},i);this.options=o;let{version:r}=o;i?._directives?(this.directives=i._directives.atDocument(),this.directives.yaml.explicit&&(r=this.directives.yaml.version)):this.directives=new ke({version:r}),this.setSchema(r,i),this.contents=t===void 0?null:this.createNode(t,s,i)}clone(){const t=Object.create(Ii.prototype,{[K]:{value:bt}});return t.commentBefore=this.commentBefore,t.comment=this.comment,t.errors=this.errors.slice(),t.warnings=this.warnings.slice(),t.options=Object.assign({},this.options),this.directives&&(t.directives=this.directives.clone()),t.schema=this.schema.clone(),t.contents=N(this.contents)?this.contents.clone(t.schema):this.contents,this.range&&(t.range=this.range.slice()),t}add(t){je(this.contents)&&this.contents.add(t)}addIn(t,n){je(this.contents)&&this.contents.addIn(t,n)}createAlias(t,n){if(!t.anchor){const i=ln(this);t.anchor=!n||i.has(n)?fn(n||"a",i):n}return new $t(t.anchor)}createNode(t,n,i){let s;if(typeof n=="function")t=n.call({"":t},"",t),s=n;else if(Array.isArray(n)){const m=w=>typeof w=="number"||w instanceof String||w instanceof Number,b=n.filter(m).map(String);b.length>0&&(n=n.concat(b)),s=n}else i===void 0&&n&&(i=n,n=void 0);const{aliasDuplicateObjects:o,anchorPrefix:r,flow:a,keepUndefined:c,onTagObj:l,tag:f}=i??{},{onAnchor:h,setAnchors:d,sourceObjects:u}=Pi(this,r||"a"),g={aliasDuplicateObjects:o??!0,keepUndefined:c??!1,onAnchor:h,onTagObj:l,replacer:s,schema:this.schema,sourceObjects:u},p=Le(t,f,g);return a&&I(p)&&(p.flow=!0),d(),p}createPair(t,n,i={}){const s=this.createNode(t,null,i),o=this.createNode(n,null,i);return new M(s,o)}delete(t){return je(this.contents)?this.contents.delete(t):!1}deleteIn(t){return Ce(t)?this.contents==null?!1:(this.contents=null,!0):je(this.contents)?this.contents.deleteIn(t):!1}get(t,n){return I(this.contents)?this.contents.get(t,n):void 0}getIn(t,n){return Ce(t)?!n&&T(this.contents)?this.contents.value:this.contents:I(this.contents)?this.contents.getIn(t,n):void 0}has(t){return I(this.contents)?this.contents.has(t):!1}hasIn(t){return Ce(t)?this.contents!==void 0:I(this.contents)?this.contents.hasIn(t):!1}set(t,n){this.contents==null?this.contents=Je(this.schema,[t],n):je(this.contents)&&this.contents.set(t,n)}setIn(t,n){Ce(t)?this.contents=n:this.contents==null?this.contents=Je(this.schema,Array.from(t),n):je(this.contents)&&this.contents.setIn(t,n)}setSchema(t,n={}){typeof t=="number"&&(t=String(t));let i;switch(t){case"1.1":this.directives?this.directives.yaml.version="1.1":this.directives=new ke({version:"1.1"}),i={resolveKnownTags:!1,schema:"yaml-1.1"};break;case"1.2":case"next":this.directives?this.directives.yaml.version=t:this.directives=new ke({version:t}),i={resolveKnownTags:!0,schema:"core"};break;case null:this.directives&&delete this.directives,i=null;break;default:{const s=JSON.stringify(t);throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${s}`)}}if(n.schema instanceof Object)this.schema=n.schema;else if(i)this.schema=new cs(Object.assign(i,n));else throw new Error("With a null YAML version, the { schema: Schema } option is required")}toJS({json:t,jsonArg:n,mapAsMap:i,maxAliasCount:s,onAnchor:o,reviver:r}={}){const a={anchors:new Map,doc:this,keep:!t,mapAsMap:i===!0,mapKeyWarned:!1,maxAliasCount:typeof s=="number"?s:100},c=U(this.contents,n??"",a);if(typeof o=="function")for(const{count:l,res:f}of a.anchors.values())o(f,l);return typeof r=="function"?$e(r,{"":c},"",c):c}toJSON(t,n){return this.toJS({json:!0,jsonArg:t,mapAsMap:!1,onAnchor:n})}toString(t={}){if(this.errors.length>0)throw new Error("Document with errors cannot be stringified");if("indent"in t&&(!Number.isInteger(t.indent)||Number(t.indent)<=0)){const n=JSON.stringify(t.indent);throw new Error(`"indent" option must be a positive integer, not ${n}`)}return ls(this,t)}};function je(e){if(I(e))return!0;throw new Error("Expected a YAML collection as document contents")}var zn=class extends Error{constructor(e,t,n,i){super(),this.name=e,this.code=n,this.message=i,this.pos=t}},Pe=class extends zn{constructor(e,t,n){super("YAMLParseError",e,t,n)}},fs=class extends zn{constructor(e,t,n){super("YAMLWarning",e,t,n)}},Dn=(e,t)=>n=>{if(n.pos[0]===-1)return;n.linePos=n.pos.map(a=>t.linePos(a));const{line:i,col:s}=n.linePos[0];n.message+=` at line ${i}, column ${s}`;let o=s-1,r=e.substring(t.lineStarts[i-1],t.lineStarts[i]).replace(/[\n\r]+$/,"");if(o>=60&&r.length>80){const a=Math.min(o-39,r.length-79);r="\u2026"+r.substring(a),o-=a-1}if(r.length>80&&(r=r.substring(0,79)+"\u2026"),i>1&&/^ *$/.test(r.substring(0,o))){let a=e.substring(t.lineStarts[i-2],t.lineStarts[i-1]);a.length>80&&(a=a.substring(0,79)+`\u2026
`),r=a+r}if(/[^ ]/.test(r)){let a=1;const c=n.linePos[1];c?.line===i&&c.col>s&&(a=Math.max(1,Math.min(c.col-s,80-o)));const l=" ".repeat(o)+"^".repeat(a);n.message+=`:

${r}
${l}
`}};function Te(e,{flow:t,indicator:n,next:i,offset:s,onError:o,parentIndent:r,startOnNewline:a}){let c=!1,l=a,f=a,h="",d="",u=!1,g=!1,p=null,m=null,b=null,w=null,k=null,$=null,x=null;for(const y of e)switch(g&&(y.type!=="space"&&y.type!=="newline"&&y.type!=="comma"&&o(y.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),g=!1),p&&(l&&y.type!=="comment"&&y.type!=="newline"&&o(p,"TAB_AS_INDENT","Tabs are not allowed as indentation"),p=null),y.type){case"space":!t&&(n!=="doc-start"||i?.type!=="flow-collection")&&y.source.includes("	")&&(p=y),f=!0;break;case"comment":{f||o(y,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const L=y.source.substring(1)||" ";h?h+=d+L:h=L,d="",l=!1;break}case"newline":l?h?h+=y.source:(!$||n!=="seq-item-ind")&&(c=!0):d+=y.source,l=!0,u=!0,(m||b)&&(w=y),f=!0;break;case"anchor":m&&o(y,"MULTIPLE_ANCHORS","A node can have at most one anchor"),y.source.endsWith(":")&&o(y.offset+y.source.length-1,"BAD_ALIAS","Anchor ending in : is ambiguous",!0),m=y,x??(x=y.offset),l=!1,f=!1,g=!0;break;case"tag":{b&&o(y,"MULTIPLE_TAGS","A node can have at most one tag"),b=y,x??(x=y.offset),l=!1,f=!1,g=!0;break}case n:(m||b)&&o(y,"BAD_PROP_ORDER",`Anchors and tags must be after the ${y.source} indicator`),$&&o(y,"UNEXPECTED_TOKEN",`Unexpected ${y.source} in ${t??"collection"}`),$=y,l=n==="seq-item-ind"||n==="explicit-key-ind",f=!1;break;case"comma":if(t){k&&o(y,"UNEXPECTED_TOKEN",`Unexpected , in ${t}`),k=y,l=!1,f=!1;break}default:o(y,"UNEXPECTED_TOKEN",`Unexpected ${y.type} token`),l=!1,f=!1}const A=e[e.length-1],j=A?A.offset+A.source.length:s;return g&&i&&i.type!=="space"&&i.type!=="newline"&&i.type!=="comma"&&(i.type!=="scalar"||i.source!=="")&&o(i.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),p&&(l&&p.indent<=r||i?.type==="block-map"||i?.type==="block-seq")&&o(p,"TAB_AS_INDENT","Tabs are not allowed as indentation"),{comma:k,found:$,spaceBefore:c,comment:h,hasNewline:u,anchor:m,tag:b,newlineAfterProp:w,end:j,start:x??j}}function Re(e){if(!e)return null;switch(e.type){case"alias":case"scalar":case"double-quoted-scalar":case"single-quoted-scalar":if(e.source.includes(`
`))return!0;if(e.end){for(const t of e.end)if(t.type==="newline")return!0}return!1;case"flow-collection":for(const t of e.items){for(const n of t.start)if(n.type==="newline")return!0;if(t.sep){for(const n of t.sep)if(n.type==="newline")return!0}if(Re(t.key)||Re(t.value))return!0}return!1;default:return!0}}function Bt(e,t,n){if(t?.type==="flow-collection"){const i=t.end[0];i.indent===e&&(i.source==="]"||i.source==="}")&&Re(t)&&n(i,"BAD_INDENT","Flow end indicator should be more indented than parent",!0)}}function Mn(e,t,n){const{uniqueKeys:i}=e.options;if(i===!1)return!1;const s=typeof i=="function"?i:(o,r)=>o===r||T(o)&&T(r)&&o.value===r.value;return t.some(o=>s(o.key,n))}var Kn="All mapping items must start at the same column";function hs({composeNode:e,composeEmptyNode:t},n,i,s,o){const r=o?.nodeClass??F,a=new r(n.schema);n.atRoot&&(n.atRoot=!1);let c=i.offset,l=null;for(const f of i.items){const{start:h,key:d,sep:u,value:g}=f,p=Te(h,{indicator:"explicit-key-ind",next:d??u?.[0],offset:c,onError:s,parentIndent:i.indent,startOnNewline:!0}),m=!p.found;if(m){if(d&&(d.type==="block-seq"?s(c,"BLOCK_AS_IMPLICIT_KEY","A block sequence may not be used as an implicit map key"):"indent"in d&&d.indent!==i.indent&&s(c,"BAD_INDENT",Kn)),!p.anchor&&!p.tag&&!u){l=p.end,p.comment&&(a.comment?a.comment+=`
`+p.comment:a.comment=p.comment);continue}(p.newlineAfterProp||Re(d))&&s(d??h[h.length-1],"MULTILINE_IMPLICIT_KEY","Implicit keys need to be on a single line")}else p.found?.indent!==i.indent&&s(c,"BAD_INDENT",Kn);n.atKey=!0;const b=p.end,w=d?e(n,d,p,s):t(n,b,h,null,p,s);n.schema.compat&&Bt(i.indent,d,s),n.atKey=!1,Mn(n,a.items,w)&&s(b,"DUPLICATE_KEY","Map keys must be unique");const k=Te(u??[],{indicator:"map-value-ind",next:g,offset:w.range[2],onError:s,parentIndent:i.indent,startOnNewline:!d||d.type==="block-scalar"});if(c=k.end,k.found){m&&(g?.type==="block-map"&&!k.hasNewline&&s(c,"BLOCK_AS_IMPLICIT_KEY","Nested mappings are not allowed in compact mappings"),n.options.strict&&p.start<k.found.offset-1024&&s(w.range,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit block mapping key"));const $=g?e(n,g,k,s):t(n,c,u,null,k,s);n.schema.compat&&Bt(i.indent,g,s),c=$.range[2];const x=new M(w,$);n.options.keepSourceTokens&&(x.srcToken=f),a.items.push(x)}else{m&&s(w.range,"MISSING_CHAR","Implicit map keys need to be followed by map values"),k.comment&&(w.comment?w.comment+=`
`+k.comment:w.comment=k.comment);const $=new M(w);n.options.keepSourceTokens&&($.srcToken=f),a.items.push($)}}return l&&l<c&&s(l,"IMPOSSIBLE","Map comment with trailing content"),a.range=[i.offset,c,l??c],a}function ds({composeNode:e,composeEmptyNode:t},n,i,s,o){const r=o?.nodeClass??ce,a=new r(n.schema);n.atRoot&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let c=i.offset,l=null;for(const{start:f,value:h}of i.items){const d=Te(f,{indicator:"seq-item-ind",next:h,offset:c,onError:s,parentIndent:i.indent,startOnNewline:!0});if(!d.found)if(d.anchor||d.tag||h)h?.type==="block-seq"?s(d.end,"BAD_INDENT","All sequence items must start at the same column"):s(c,"MISSING_CHAR","Sequence item without - indicator");else{l=d.end,d.comment&&(a.comment=d.comment);continue}const u=h?e(n,h,d,s):t(n,d.end,f,null,d,s);n.schema.compat&&Bt(i.indent,h,s),c=u.range[2],a.items.push(u)}return a.range=[i.offset,c,l??c],a}function Be(e,t,n,i){let s="";if(e){let o=!1,r="";for(const a of e){const{source:c,type:l}=a;switch(l){case"space":o=!0;break;case"comment":{n&&!o&&i(a,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const f=c.substring(1)||" ";s?s+=r+f:s=f,r="";break}case"newline":s&&(r+=c),o=!0;break;default:i(a,"UNEXPECTED_TOKEN",`Unexpected ${l} at node end`)}t+=c.length}}return{comment:s,offset:t}}var zt="Block collections are not allowed within flow collections",Dt=e=>e&&(e.type==="block-map"||e.type==="block-seq");function ps({composeNode:e,composeEmptyNode:t},n,i,s,o){const r=i.start.source==="{",a=r?"flow map":"flow sequence",c=o?.nodeClass??(r?F:ce),l=new c(n.schema);l.flow=!0;const f=n.atRoot;f&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let h=i.offset+i.start.source.length;for(let m=0;m<i.items.length;++m){const b=i.items[m],{start:w,key:k,sep:$,value:x}=b,A=Te(w,{flow:a,indicator:"explicit-key-ind",next:k??$?.[0],offset:h,onError:s,parentIndent:i.indent,startOnNewline:!1});if(!A.found){if(!A.anchor&&!A.tag&&!$&&!x){m===0&&A.comma?s(A.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`):m<i.items.length-1&&s(A.start,"UNEXPECTED_TOKEN",`Unexpected empty item in ${a}`),A.comment&&(l.comment?l.comment+=`
`+A.comment:l.comment=A.comment),h=A.end;continue}!r&&n.options.strict&&Re(k)&&s(k,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line")}if(m===0)A.comma&&s(A.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`);else if(A.comma||s(A.start,"MISSING_CHAR",`Missing , between ${a} items`),A.comment){let j="";e:for(const y of w)switch(y.type){case"comma":case"space":break;case"comment":j=y.source.substring(1);break e;default:break e}if(j){let y=l.items[l.items.length-1];O(y)&&(y=y.value??y.key),y.comment?y.comment+=`
`+j:y.comment=j,A.comment=A.comment.substring(j.length+1)}}if(!r&&!$&&!A.found){const j=x?e(n,x,A,s):t(n,A.end,$,null,A,s);l.items.push(j),h=j.range[2],Dt(x)&&s(j.range,"BLOCK_IN_FLOW",zt)}else{n.atKey=!0;const j=A.end,y=k?e(n,k,A,s):t(n,j,w,null,A,s);Dt(k)&&s(y.range,"BLOCK_IN_FLOW",zt),n.atKey=!1;const L=Te($??[],{flow:a,indicator:"map-value-ind",next:x,offset:y.range[2],onError:s,parentIndent:i.indent,startOnNewline:!1});if(L.found){if(!r&&!A.found&&n.options.strict){if($)for(const C of $){if(C===L.found)break;if(C.type==="newline"){s(C,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line");break}}A.start<L.found.offset-1024&&s(L.found,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit flow sequence key")}}else x&&("source"in x&&x.source?.[0]===":"?s(x,"MISSING_CHAR",`Missing space after : in ${a}`):s(L.start,"MISSING_CHAR",`Missing , or : between ${a} items`));const ee=x?e(n,x,L,s):L.found?t(n,L.end,$,null,L,s):null;ee?Dt(x)&&s(ee.range,"BLOCK_IN_FLOW",zt):L.comment&&(y.comment?y.comment+=`
`+L.comment:y.comment=L.comment);const ue=new M(y,ee);if(n.options.keepSourceTokens&&(ue.srcToken=b),r){const C=l;Mn(n,C.items,y)&&s(j,"DUPLICATE_KEY","Map keys must be unique"),C.items.push(ue)}else{const C=new F(n.schema);C.flow=!0,C.items.push(ue);const en=(ee??y).range;C.range=[y.range[0],en[1],en[2]],l.items.push(C)}h=ee?ee.range[2]:L.end}}const d=r?"}":"]",[u,...g]=i.end;let p=h;if(u?.source===d)p=u.offset+u.source.length;else{const m=a[0].toUpperCase()+a.substring(1),b=f?`${m} must end with a ${d}`:`${m} in block collection must be sufficiently indented and end with a ${d}`;s(h,f?"MISSING_CHAR":"BAD_INDENT",b),u&&u.source.length!==1&&g.unshift(u)}if(g.length>0){const m=Be(g,p,n.options.strict,s);m.comment&&(l.comment?l.comment+=`
`+m.comment:l.comment=m.comment),l.range=[i.offset,p,m.offset]}else l.range=[i.offset,p,p];return l}function Mt(e,t,n,i,s,o){const r=n.type==="block-map"?hs(e,t,n,i,o):n.type==="block-seq"?ds(e,t,n,i,o):ps(e,t,n,i,o),a=r.constructor;return s==="!"||s===a.tagName?(r.tag=a.tagName,r):(s&&(r.tag=s),r)}function us(e,t,n,i,s){const o=i.tag,r=o?t.directives.tagName(o.source,d=>s(o,"TAG_RESOLVE_FAILED",d)):null;if(n.type==="block-seq"){const{anchor:d,newlineAfterProp:u}=i,g=d&&o?d.offset>o.offset?d:o:d??o;g&&(!u||u.offset<g.offset)&&s(g,"MISSING_CHAR","Missing newline after block sequence props")}const a=n.type==="block-map"?"map":n.type==="block-seq"?"seq":n.start.source==="{"?"map":"seq";if(!o||!r||r==="!"||r===F.tagName&&a==="map"||r===ce.tagName&&a==="seq")return Mt(e,t,n,s,r);let c=t.schema.tags.find(d=>d.tag===r&&d.collection===a);if(!c){const d=t.schema.knownTags[r];if(d?.collection===a)t.schema.tags.push(Object.assign({},d,{default:!1})),c=d;else return d?s(o,"BAD_COLLECTION_TYPE",`${d.tag} used for ${a} collection, but expects ${d.collection??"scalar"}`,!0):s(o,"TAG_RESOLVE_FAILED",`Unresolved tag: ${r}`,!0),Mt(e,t,n,s,r)}const l=Mt(e,t,n,s,r,c),f=c.resolve?.(l,d=>s(o,"TAG_RESOLVE_FAILED",d),t.options)??l,h=N(f)?f:new v(f);return h.range=l.range,h.tag=r,c?.format&&(h.format=c.format),h}function ms(e,t,n){const i=t.offset,s=gs(t,e.options.strict,n);if(!s)return{value:"",type:null,comment:"",range:[i,i,i]};const o=s.mode===">"?v.BLOCK_FOLDED:v.BLOCK_LITERAL,r=t.source?ys(t.source):[];let a=r.length;for(let p=r.length-1;p>=0;--p){const m=r[p][1];if(m===""||m==="\r")a=p;else break}if(a===0){const p=s.chomp==="+"&&r.length>0?`
`.repeat(Math.max(1,r.length-1)):"";let m=i+s.length;return t.source&&(m+=t.source.length),{value:p,type:o,comment:s.comment,range:[i,m,m]}}let c=t.indent+s.indent,l=t.offset+s.length,f=0;for(let p=0;p<a;++p){const[m,b]=r[p];if(b===""||b==="\r")s.indent===0&&m.length>c&&(c=m.length);else{m.length<c&&n(l+m.length,"MISSING_CHAR","Block scalars with more-indented leading empty lines must use an explicit indentation indicator"),s.indent===0&&(c=m.length),f=p,c===0&&!e.atRoot&&n(l,"BAD_INDENT","Block scalar values in collections must be indented");break}l+=m.length+b.length+1}for(let p=r.length-1;p>=a;--p)r[p][0].length>c&&(a=p+1);let h="",d="",u=!1;for(let p=0;p<f;++p)h+=r[p][0].slice(c)+`
`;for(let p=f;p<a;++p){let[m,b]=r[p];l+=m.length+b.length+1;const w=b[b.length-1]==="\r";if(w&&(b=b.slice(0,-1)),b&&m.length<c){const $=`Block scalar lines must not be less indented than their ${s.indent?"explicit indentation indicator":"first line"}`;n(l-b.length-(w?2:1),"BAD_INDENT",$),m=""}o===v.BLOCK_LITERAL?(h+=d+m.slice(c)+b,d=`
`):m.length>c||b[0]==="	"?(d===" "?d=`
`:!u&&d===`
`&&(d=`

`),h+=d+m.slice(c)+b,d=`
`,u=!0):b===""?d===`
`?h+=`
`:d=`
`:(h+=d+b,d=" ",u=!1)}switch(s.chomp){case"-":break;case"+":for(let p=a;p<r.length;++p)h+=`
`+r[p][0].slice(c);h[h.length-1]!==`
`&&(h+=`
`);break;default:h+=`
`}const g=i+s.length+t.source.length;return{value:h,type:o,comment:s.comment,range:[i,g,g]}}function gs({offset:e,props:t},n,i){if(t[0].type!=="block-scalar-header")return i(t[0],"IMPOSSIBLE","Block scalar header not found"),null;const{source:s}=t[0],o=s[0];let r=0,a="",c=-1;for(let d=1;d<s.length;++d){const u=s[d];if(!a&&(u==="-"||u==="+"))a=u;else{const g=Number(u);!r&&g?r=g:c===-1&&(c=e+d)}}c!==-1&&i(c,"UNEXPECTED_TOKEN",`Block scalar header includes extra characters: ${s}`);let l=!1,f="",h=s.length;for(let d=1;d<t.length;++d){const u=t[d];switch(u.type){case"space":l=!0;case"newline":h+=u.source.length;break;case"comment":n&&!l&&i(u,"MISSING_CHAR","Comments must be separated from other tokens by white space characters"),h+=u.source.length,f=u.source.substring(1);break;case"error":i(u,"UNEXPECTED_TOKEN",u.message),h+=u.source.length;break;default:{const g=`Unexpected token in block scalar header: ${u.type}`;i(u,"UNEXPECTED_TOKEN",g);const p=u.source;p&&typeof p=="string"&&(h+=p.length)}}}return{mode:o,indent:r,chomp:a,comment:f,length:h}}function ys(e){const t=e.split(/\n( *)/),n=t[0],i=n.match(/^( *)/),o=[i?.[1]?[i[1],n.slice(i[1].length)]:["",n]];for(let r=1;r<t.length;r+=2)o.push([t[r],t[r+1]]);return o}function bs(e,t,n){const{offset:i,type:s,source:o,end:r}=e;let a,c;const l=(d,u,g)=>n(i+d,u,g);switch(s){case"scalar":a=v.PLAIN,c=ws(o,l);break;case"single-quoted-scalar":a=v.QUOTE_SINGLE,c=ks(o,l);break;case"double-quoted-scalar":a=v.QUOTE_DOUBLE,c=$s(o,l);break;default:return n(e,"UNEXPECTED_TOKEN",`Expected a flow scalar value, but found: ${s}`),{value:"",type:null,comment:"",range:[i,i+o.length,i+o.length]}}const f=i+o.length,h=Be(r,f,t,n);return{value:c,type:a,comment:h.comment,range:[i,f,h.offset]}}function ws(e,t){let n="";switch(e[0]){case"	":n="a tab character";break;case",":n="flow indicator character ,";break;case"%":n="directive indicator character %";break;case"|":case">":{n=`block scalar indicator ${e[0]}`;break}case"@":case"`":{n=`reserved character ${e[0]}`;break}}return n&&t(0,"BAD_SCALAR_START",`Plain value cannot start with ${n}`),Un(e)}function ks(e,t){return(e[e.length-1]!=="'"||e.length===1)&&t(e.length,"MISSING_CHAR","Missing closing 'quote"),Un(e.slice(1,-1)).replace(/''/g,"'")}function Un(e){let t,n;try{t=new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`,"sy"),n=new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`,"sy")}catch{t=/(.*?)[ \t]*\r?\n/sy,n=/[ \t]*(.*?)[ \t]*\r?\n/sy}let i=t.exec(e);if(!i)return e;let s=i[1],o=" ",r=t.lastIndex;for(n.lastIndex=r;i=n.exec(e);)i[1]===""?o===`
`?s+=o:o=`
`:(s+=o+i[1],o=" "),r=n.lastIndex;const a=/[ \t]*(.*)/sy;return a.lastIndex=r,i=a.exec(e),s+o+(i?.[1]??"")}function $s(e,t){let n="";for(let i=1;i<e.length-1;++i){const s=e[i];if(!(s==="\r"&&e[i+1]===`
`))if(s===`
`){const{fold:o,offset:r}=xs(e,i);n+=o,i=r}else if(s==="\\"){let o=e[++i];const r=vs[o];if(r)n+=r;else if(o===`
`)for(o=e[i+1];o===" "||o==="	";)o=e[++i+1];else if(o==="\r"&&e[i+1]===`
`)for(o=e[++i+1];o===" "||o==="	";)o=e[++i+1];else if(o==="x"||o==="u"||o==="U"){const a={x:2,u:4,U:8}[o];n+=As(e,i+1,a,t),i+=a}else{const a=e.substr(i-1,2);t(i-1,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),n+=a}}else if(s===" "||s==="	"){const o=i;let r=e[i+1];for(;r===" "||r==="	";)r=e[++i+1];r!==`
`&&!(r==="\r"&&e[i+2]===`
`)&&(n+=i>o?e.slice(o,i+1):s)}else n+=s}return(e[e.length-1]!=='"'||e.length===1)&&t(e.length,"MISSING_CHAR",'Missing closing "quote'),n}function xs(e,t){let n="",i=e[t+1];for(;(i===" "||i==="	"||i===`
`||i==="\r")&&!(i==="\r"&&e[t+2]!==`
`);)i===`
`&&(n+=`
`),t+=1,i=e[t+1];return n||(n=" "),{fold:n,offset:t}}var vs={0:"\0",a:"\x07",b:"\b",e:"\x1B",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",N:"\x85",_:"\xA0",L:"\u2028",P:"\u2029"," ":" ",'"':'"',"/":"/","\\":"\\","	":"	"};function As(e,t,n,i){const s=e.substr(t,n),r=s.length===n&&/^[0-9a-fA-F]+$/.test(s)?parseInt(s,16):NaN;if(isNaN(r)){const a=e.substr(t-2,n+2);return i(t-2,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),a}return String.fromCodePoint(r)}function Fn(e,t,n,i){const{value:s,type:o,comment:r,range:a}=t.type==="block-scalar"?ms(e,t,i):bs(t,e.options.strict,i),c=n?e.directives.tagName(n.source,h=>i(n,"TAG_RESOLVE_FAILED",h)):null;let l;e.options.stringKeys&&e.atKey?l=e.schema[H]:c?l=Ss(e.schema,s,c,n,i):t.type==="scalar"?l=js(e,s,t,i):l=e.schema[H];let f;try{const h=l.resolve(s,d=>i(n??t,"TAG_RESOLVE_FAILED",d),e.options);f=T(h)?h:new v(h)}catch(h){const d=h instanceof Error?h.message:String(h);i(n??t,"TAG_RESOLVE_FAILED",d),f=new v(s)}return f.range=a,f.source=s,o&&(f.type=o),c&&(f.tag=c),l.format&&(f.format=l.format),r&&(f.comment=r),f}function Ss(e,t,n,i,s){if(n==="!")return e[H];const o=[];for(const a of e.tags)if(!a.collection&&a.tag===n)if(a.default&&a.test)o.push(a);else return a;for(const a of o)if(a.test?.test(t))return a;const r=e.knownTags[n];return r&&!r.collection?(e.tags.push(Object.assign({},r,{default:!1,test:void 0})),r):(s(i,"TAG_RESOLVE_FAILED",`Unresolved tag: ${n}`,n!=="tag:yaml.org,2002:str"),e[H])}function js({atKey:e,directives:t,schema:n},i,s,o){const r=n.tags.find(a=>(a.default===!0||e&&a.default==="key")&&a.test?.test(i))||n[H];if(n.compat){const a=n.compat.find(c=>c.default&&c.test?.test(i))??n[H];if(r.tag!==a.tag){const c=t.tagString(r.tag),l=t.tagString(a.tag),f=`Value may be parsed as either ${c} or ${l}`;o(s,"TAG_RESOLVE_FAILED",f,!0)}}return r}function Ts(e,t,n){if(t){n??(n=t.length);for(let i=n-1;i>=0;--i){let s=t[i];switch(s.type){case"space":case"comment":case"newline":e-=s.source.length;continue}for(s=t[++i];s?.type==="space";)e+=s.source.length,s=t[++i];break}}return e}var Os={composeNode:Vn,composeEmptyNode:Kt};function Vn(e,t,n,i){const s=e.atKey,{spaceBefore:o,comment:r,anchor:a,tag:c}=n;let l,f=!0;switch(t.type){case"alias":l=Es(e,t,i),(a||c)&&i(t,"ALIAS_PROPS","An alias node must not specify any properties");break;case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"block-scalar":l=Fn(e,t,c,i),a&&(l.anchor=a.source.substring(1));break;case"block-map":case"block-seq":case"flow-collection":l=us(Os,e,t,n,i),a&&(l.anchor=a.source.substring(1));break;default:{const h=t.type==="error"?t.message:`Unsupported token (type: ${t.type})`;i(t,"UNEXPECTED_TOKEN",h),l=Kt(e,t.offset,void 0,null,n,i),f=!1}}return a&&l.anchor===""&&i(a,"BAD_ALIAS","Anchor cannot be an empty string"),s&&e.options.stringKeys&&(!T(l)||typeof l.value!="string"||l.tag&&l.tag!=="tag:yaml.org,2002:str")&&i(c??t,"NON_STRING_KEY","With stringKeys, all keys must be strings"),o&&(l.spaceBefore=!0),r&&(t.type==="scalar"&&t.source===""?l.comment=r:l.commentBefore=r),e.options.keepSourceTokens&&f&&(l.srcToken=t),l}function Kt(e,t,n,i,{spaceBefore:s,comment:o,anchor:r,tag:a,end:c},l){const f={type:"scalar",offset:Ts(t,n,i),indent:-1,source:""},h=Fn(e,f,a,l);return r&&(h.anchor=r.source.substring(1),h.anchor===""&&l(r,"BAD_ALIAS","Anchor cannot be an empty string")),s&&(h.spaceBefore=!0),o&&(h.comment=o,h.range[2]=c),h}function Es({options:e},{offset:t,source:n,end:i},s){const o=new $t(n.substring(1));o.source===""&&s(t,"BAD_ALIAS","Alias cannot be an empty string"),o.source.endsWith(":")&&s(t+n.length-1,"BAD_ALIAS","Alias ending in : is ambiguous",!0);const r=t+n.length,a=Be(i,r,e.strict,s);return o.range=[t,r,a.offset],a.comment&&(o.comment=a.comment),o}function Is(e,t,{offset:n,start:i,value:s,end:o},r){const a=Object.assign({_directives:t},e),c=new Rt(void 0,a),l={atKey:!1,atRoot:!0,directives:c.directives,options:c.options,schema:c.schema},f=Te(i,{indicator:"doc-start",next:s??o?.[0],offset:n,onError:r,parentIndent:0,startOnNewline:!0});f.found&&(c.directives.docStart=!0,s&&(s.type==="block-map"||s.type==="block-seq")&&!f.hasNewline&&r(f.end,"MISSING_CHAR","Block collection cannot start on same line with directives-end marker")),c.contents=s?Vn(l,s,f,r):Kt(l,f.end,i,null,f,r);const h=c.contents.range[2],d=Be(o,h,!1,r);return d.comment&&(c.comment=d.comment),c.range=[n,h,d.offset],c}function ze(e){if(typeof e=="number")return[e,e+1];if(Array.isArray(e))return e.length===2?e:[e[0],e[1]];const{offset:t,source:n}=e;return[t,t+(typeof n=="string"?n.length:1)]}function Jn(e){let t="",n=!1,i=!1;for(let s=0;s<e.length;++s){const o=e[s];switch(o[0]){case"#":t+=(t===""?"":i?`

`:`
`)+(o.substring(1)||" "),n=!0,i=!1;break;case"%":e[s+1]?.[0]!=="#"&&(s+=1),n=!1;break;default:n||(i=!0),n=!1}}return{comment:t,afterEmptyLine:i}}var Ns=class{constructor(e={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(t,n,i,s)=>{const o=ze(t);s?this.warnings.push(new fs(o,n,i)):this.errors.push(new Pe(o,n,i))},this.directives=new ke({version:e.version||"1.2"}),this.options=e}decorate(e,t){const{comment:n,afterEmptyLine:i}=Jn(this.prelude);if(n){const s=e.contents;if(t)e.comment=e.comment?`${e.comment}
${n}`:n;else if(i||e.directives.docStart||!s)e.commentBefore=n;else if(I(s)&&!s.flow&&s.items.length>0){let o=s.items[0];O(o)&&(o=o.key);const r=o.commentBefore;o.commentBefore=r?`${n}
${r}`:n}else{const o=s.commentBefore;s.commentBefore=o?`${n}
${o}`:n}}t?(Array.prototype.push.apply(e.errors,this.errors),Array.prototype.push.apply(e.warnings,this.warnings)):(e.errors=this.errors,e.warnings=this.warnings),this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:Jn(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(e,t=!1,n=-1){for(const i of e)yield*this.next(i);yield*this.end(t,n)}*next(e){switch(e.type){case"directive":this.directives.add(e.source,(t,n,i)=>{const s=ze(e);s[0]+=t,this.onError(s,"BAD_DIRECTIVE",n,i)}),this.prelude.push(e.source),this.atDirectives=!0;break;case"document":{const t=Is(this.options,this.directives,e,this.onError);this.atDirectives&&!t.directives.docStart&&this.onError(e,"MISSING_CHAR","Missing directives-end/doc-start indicator line"),this.decorate(t,!1),this.doc&&(yield this.doc),this.doc=t,this.atDirectives=!1;break}case"byte-order-mark":case"space":break;case"comment":case"newline":this.prelude.push(e.source);break;case"error":{const t=e.source?`${e.message}: ${JSON.stringify(e.source)}`:e.message,n=new Pe(ze(e),"UNEXPECTED_TOKEN",t);this.atDirectives||!this.doc?this.errors.push(n):this.doc.errors.push(n);break}case"doc-end":{if(!this.doc){const n="Unexpected doc-end without preceding document";this.errors.push(new Pe(ze(e),"UNEXPECTED_TOKEN",n));break}this.doc.directives.docEnd=!0;const t=Be(e.end,e.offset+e.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),t.comment){const n=this.doc.comment;this.doc.comment=n?`${n}
${t.comment}`:t.comment}this.doc.range[2]=t.offset;break}default:this.errors.push(new Pe(ze(e),"UNEXPECTED_TOKEN",`Unsupported token ${e.type}`))}}*end(e=!1,t=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(e){const n=Object.assign({_directives:this.directives},this.options),i=new Rt(void 0,n);this.atDirectives&&this.onError(t,"MISSING_CHAR","Missing directives-end indicator line"),i.range=[0,t,t],this.decorate(i,!1),yield i}}},Ut=Symbol("break visit"),Ls=Symbol("skip children"),Hn=Symbol("remove item");function Oe(e,t){"type"in e&&e.type==="document"&&(e={start:e.start,value:e.value}),Wn(Object.freeze([]),e,t)}Oe.BREAK=Ut,Oe.SKIP=Ls,Oe.REMOVE=Hn,Oe.itemAtPath=(e,t)=>{let n=e;for(const[i,s]of t){const o=n?.[i];if(o&&"items"in o)n=o.items[s];else return}return n},Oe.parentCollection=(e,t)=>{const n=Oe.itemAtPath(e,t.slice(0,-1)),i=t[t.length-1][0],s=n?.[i];if(s&&"items"in s)return s;throw new Error("Parent collection not found")};function Wn(e,t,n){let i=n(t,e);if(typeof i=="symbol")return i;for(const s of["key","value"]){const o=t[s];if(o&&"items"in o){for(let r=0;r<o.items.length;++r){const a=Wn(Object.freeze(e.concat([[s,r]])),o.items[r],n);if(typeof a=="number")r=a-1;else{if(a===Ut)return Ut;a===Hn&&(o.items.splice(r,1),r-=1)}}typeof i=="function"&&s==="key"&&(i=i(t,e))}}return typeof i=="function"?i(t,e):i}var Gn="\uFEFF",Yn="",Qn="",Ft="";function Cs(e){switch(e){case Gn:return"byte-order-mark";case Yn:return"doc-mode";case Qn:return"flow-error-end";case Ft:return"scalar";case"---":return"doc-start";case"...":return"doc-end";case"":case`
`:case`\r
`:return"newline";case"-":return"seq-item-ind";case"?":return"explicit-key-ind";case":":return"map-value-ind";case"{":return"flow-map-start";case"}":return"flow-map-end";case"[":return"flow-seq-start";case"]":return"flow-seq-end";case",":return"comma"}switch(e[0]){case" ":case"	":return"space";case"#":return"comment";case"%":return"directive-line";case"*":return"alias";case"&":return"anchor";case"!":return"tag";case"'":return"single-quoted-scalar";case'"':return"double-quoted-scalar";case"|":case">":return"block-scalar-header"}return null}function J(e){switch(e){case void 0:case" ":case`
`:case"\r":case"	":return!0;default:return!1}}var Xn=new Set("0123456789ABCDEFabcdef"),_s=new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()"),lt=new Set(",[]{}"),qs=new Set(` ,[]{}
\r	`),Vt=e=>!e||qs.has(e),Ps=class{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer="",this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(e,t=!1){if(e){if(typeof e!="string")throw TypeError("source is not a string");this.buffer=this.buffer?this.buffer+e:e,this.lineEndPos=null}this.atEnd=!t;let n=this.next??"stream";for(;n&&(t||this.hasChars(1));)n=yield*this.parseNext(n)}atLineEnd(){let e=this.pos,t=this.buffer[e];for(;t===" "||t==="	";)t=this.buffer[++e];return!t||t==="#"||t===`
`?!0:t==="\r"?this.buffer[e+1]===`
`:!1}charAt(e){return this.buffer[this.pos+e]}continueScalar(e){let t=this.buffer[e];if(this.indentNext>0){let n=0;for(;t===" ";)t=this.buffer[++n+e];if(t==="\r"){const i=this.buffer[n+e+1];if(i===`
`||!i&&!this.atEnd)return e+n+1}return t===`
`||n>=this.indentNext||!t&&!this.atEnd?e+n:-1}if(t==="-"||t==="."){const n=this.buffer.substr(e,3);if((n==="---"||n==="...")&&J(this.buffer[e+3]))return-1}return e}getLine(){let e=this.lineEndPos;return(typeof e!="number"||e!==-1&&e<this.pos)&&(e=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=e),e===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[e-1]==="\r"&&(e-=1),this.buffer.substring(this.pos,e))}hasChars(e){return this.pos+e<=this.buffer.length}setNext(e){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=e,null}peek(e){return this.buffer.substr(this.pos,e)}*parseNext(e){switch(e){case"stream":return yield*this.parseStream();case"line-start":return yield*this.parseLineStart();case"block-start":return yield*this.parseBlockStart();case"doc":return yield*this.parseDocument();case"flow":return yield*this.parseFlowCollection();case"quoted-scalar":return yield*this.parseQuotedScalar();case"block-scalar":return yield*this.parseBlockScalar();case"plain-scalar":return yield*this.parsePlainScalar()}}*parseStream(){let e=this.getLine();if(e===null)return this.setNext("stream");if(e[0]===Gn&&(yield*this.pushCount(1),e=e.substring(1)),e[0]==="%"){let t=e.length,n=e.indexOf("#");for(;n!==-1;){const s=e[n-1];if(s===" "||s==="	"){t=n-1;break}else n=e.indexOf("#",n+1)}for(;;){const s=e[t-1];if(s===" "||s==="	")t-=1;else break}const i=(yield*this.pushCount(t))+(yield*this.pushSpaces(!0));return yield*this.pushCount(e.length-i),this.pushNewline(),"stream"}if(this.atLineEnd()){const t=yield*this.pushSpaces(!0);return yield*this.pushCount(e.length-t),yield*this.pushNewline(),"stream"}return yield Yn,yield*this.parseLineStart()}*parseLineStart(){const e=this.charAt(0);if(!e&&!this.atEnd)return this.setNext("line-start");if(e==="-"||e==="."){if(!this.atEnd&&!this.hasChars(4))return this.setNext("line-start");const t=this.peek(3);if((t==="---"||t==="...")&&J(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,t==="---"?"doc":"stream"}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!J(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){const[e,t]=this.peek(2);if(!t&&!this.atEnd)return this.setNext("block-start");if((e==="-"||e==="?"||e===":")&&J(t)){const n=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=n,yield*this.parseBlockStart()}return"doc"}*parseDocument(){yield*this.pushSpaces(!0);const e=this.getLine();if(e===null)return this.setNext("doc");let t=yield*this.pushIndicators();switch(e[t]){case"#":yield*this.pushCount(e.length-t);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,"flow";case"}":case"]":return yield*this.pushCount(1),"doc";case"*":return yield*this.pushUntil(Vt),"doc";case'"':case"'":return yield*this.parseQuotedScalar();case"|":case">":return t+=yield*this.parseBlockScalarHeader(),t+=yield*this.pushSpaces(!0),yield*this.pushCount(e.length-t),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let e,t,n=-1;do e=yield*this.pushNewline(),e>0?(t=yield*this.pushSpaces(!1),this.indentValue=n=t):t=0,t+=yield*this.pushSpaces(!0);while(e+t>0);const i=this.getLine();if(i===null)return this.setNext("flow");if((n!==-1&&n<this.indentNext&&i[0]!=="#"||n===0&&(i.startsWith("---")||i.startsWith("..."))&&J(i[3]))&&!(n===this.indentNext-1&&this.flowLevel===1&&(i[0]==="]"||i[0]==="}")))return this.flowLevel=0,yield Qn,yield*this.parseLineStart();let s=0;for(;i[s]===",";)s+=yield*this.pushCount(1),s+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(s+=yield*this.pushIndicators(),i[s]){case void 0:return"flow";case"#":return yield*this.pushCount(i.length-s),"flow";case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,"flow";case"}":case"]":return yield*this.pushCount(1),this.flowKey=!0,this.flowLevel-=1,this.flowLevel?"flow":"doc";case"*":return yield*this.pushUntil(Vt),"flow";case'"':case"'":return this.flowKey=!0,yield*this.parseQuotedScalar();case":":{const o=this.charAt(1);if(this.flowKey||J(o)||o===",")return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),"flow"}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){const e=this.charAt(0);let t=this.buffer.indexOf(e,this.pos+1);if(e==="'")for(;t!==-1&&this.buffer[t+1]==="'";)t=this.buffer.indexOf("'",t+2);else for(;t!==-1;){let s=0;for(;this.buffer[t-1-s]==="\\";)s+=1;if(s%2===0)break;t=this.buffer.indexOf('"',t+1)}const n=this.buffer.substring(0,t);let i=n.indexOf(`
`,this.pos);if(i!==-1){for(;i!==-1;){const s=this.continueScalar(i+1);if(s===-1)break;i=n.indexOf(`
`,s)}i!==-1&&(t=i-(n[i-1]==="\r"?2:1))}if(t===-1){if(!this.atEnd)return this.setNext("quoted-scalar");t=this.buffer.length}return yield*this.pushToIndex(t+1,!1),this.flowLevel?"flow":"doc"}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let e=this.pos;for(;;){const t=this.buffer[++e];if(t==="+")this.blockScalarKeep=!0;else if(t>"0"&&t<="9")this.blockScalarIndent=Number(t)-1;else if(t!=="-")break}return yield*this.pushUntil(t=>J(t)||t==="#")}*parseBlockScalar(){let e=this.pos-1,t=0,n;e:for(let s=this.pos;n=this.buffer[s];++s)switch(n){case" ":t+=1;break;case`
`:e=s,t=0;break;case"\r":{const o=this.buffer[s+1];if(!o&&!this.atEnd)return this.setNext("block-scalar");if(o===`
`)break}default:break e}if(!n&&!this.atEnd)return this.setNext("block-scalar");if(t>=this.indentNext){this.blockScalarIndent===-1?this.indentNext=t:this.indentNext=this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{const s=this.continueScalar(e+1);if(s===-1)break;e=this.buffer.indexOf(`
`,s)}while(e!==-1);if(e===-1){if(!this.atEnd)return this.setNext("block-scalar");e=this.buffer.length}}let i=e+1;for(n=this.buffer[i];n===" ";)n=this.buffer[++i];if(n==="	"){for(;n==="	"||n===" "||n==="\r"||n===`
`;)n=this.buffer[++i];e=i-1}else if(!this.blockScalarKeep)do{let s=e-1,o=this.buffer[s];o==="\r"&&(o=this.buffer[--s]);const r=s;for(;o===" ";)o=this.buffer[--s];if(o===`
`&&s>=this.pos&&s+1+t>r)e=s;else break}while(!0);return yield Ft,yield*this.pushToIndex(e+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){const e=this.flowLevel>0;let t=this.pos-1,n=this.pos-1,i;for(;i=this.buffer[++n];)if(i===":"){const s=this.buffer[n+1];if(J(s)||e&&lt.has(s))break;t=n}else if(J(i)){let s=this.buffer[n+1];if(i==="\r"&&(s===`
`?(n+=1,i=`
`,s=this.buffer[n+1]):t=n),s==="#"||e&&lt.has(s))break;if(i===`
`){const o=this.continueScalar(n+1);if(o===-1)break;n=Math.max(n,o-2)}}else{if(e&&lt.has(i))break;t=n}return!i&&!this.atEnd?this.setNext("plain-scalar"):(yield Ft,yield*this.pushToIndex(t+1,!0),e?"flow":"doc")}*pushCount(e){return e>0?(yield this.buffer.substr(this.pos,e),this.pos+=e,e):0}*pushToIndex(e,t){const n=this.buffer.slice(this.pos,e);return n?(yield n,this.pos+=n.length,n.length):(t&&(yield""),0)}*pushIndicators(){switch(this.charAt(0)){case"!":return(yield*this.pushTag())+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"&":return(yield*this.pushUntil(Vt))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"-":case"?":case":":{const e=this.flowLevel>0,t=this.charAt(1);if(J(t)||e&&lt.has(t))return e?this.flowKey&&(this.flowKey=!1):this.indentNext=this.indentValue+1,(yield*this.pushCount(1))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators())}}return 0}*pushTag(){if(this.charAt(1)==="<"){let e=this.pos+2,t=this.buffer[e];for(;!J(t)&&t!==">";)t=this.buffer[++e];return yield*this.pushToIndex(t===">"?e+1:e,!1)}else{let e=this.pos+1,t=this.buffer[e];for(;t;)if(_s.has(t))t=this.buffer[++e];else if(t==="%"&&Xn.has(this.buffer[e+1])&&Xn.has(this.buffer[e+2]))t=this.buffer[e+=3];else break;return yield*this.pushToIndex(e,!1)}}*pushNewline(){const e=this.buffer[this.pos];return e===`
`?yield*this.pushCount(1):e==="\r"&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(e){let t=this.pos-1,n;do n=this.buffer[++t];while(n===" "||e&&n==="	");const i=t-this.pos;return i>0&&(yield this.buffer.substr(this.pos,i),this.pos=t),i}*pushUntil(e){let t=this.pos,n=this.buffer[t];for(;!e(n);)n=this.buffer[++t];return yield*this.pushToIndex(t,!1)}},Rs=class{constructor(){this.lineStarts=[],this.addNewLine=e=>this.lineStarts.push(e),this.linePos=e=>{let t=0,n=this.lineStarts.length;for(;t<n;){const s=t+n>>1;this.lineStarts[s]<e?t=s+1:n=s}if(this.lineStarts[t]===e)return{line:t+1,col:1};if(t===0)return{line:0,col:e};const i=this.lineStarts[t-1];return{line:t,col:e-i+1}}}};function ne(e,t){for(let n=0;n<e.length;++n)if(e[n].type===t)return!0;return!1}function Zn(e){for(let t=0;t<e.length;++t)switch(e[t].type){case"space":case"comment":case"newline":break;default:return t}return-1}function ei(e){switch(e?.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"flow-collection":return!0;default:return!1}}function ft(e){switch(e.type){case"document":return e.start;case"block-map":{const t=e.items[e.items.length-1];return t.sep??t.start}case"block-seq":return e.items[e.items.length-1].start;default:return[]}}function Ee(e){if(e.length===0)return[];let t=e.length;e:for(;--t>=0;)switch(e[t].type){case"doc-start":case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":case"newline":break e}for(;e[++t]?.type==="space";);return e.splice(t,e.length)}function ti(e){if(e.start.type==="flow-seq-start")for(const t of e.items)t.sep&&!t.value&&!ne(t.start,"explicit-key-ind")&&!ne(t.sep,"map-value-ind")&&(t.key&&(t.value=t.key),delete t.key,ei(t.value)?t.value.end?Array.prototype.push.apply(t.value.end,t.sep):t.value.end=t.sep:Array.prototype.push.apply(t.start,t.sep),delete t.sep)}var Bs=class{constructor(e){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source="",this.type="",this.lexer=new Ps,this.onNewLine=e}*parse(e,t=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(const n of this.lexer.lex(e,t))yield*this.next(n);t||(yield*this.end())}*next(e){if(this.source=e,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=e.length;return}const t=Cs(e);if(t)if(t==="scalar")this.atNewLine=!1,this.atScalar=!0,this.type="scalar";else{switch(this.type=t,yield*this.step(),t){case"newline":this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+e.length);break;case"space":this.atNewLine&&e[0]===" "&&(this.indent+=e.length);break;case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":this.atNewLine&&(this.indent+=e.length);break;case"doc-mode":case"flow-error-end":return;default:this.atNewLine=!1}this.offset+=e.length}else{const n=`Not a YAML token: ${e}`;yield*this.pop({type:"error",offset:this.offset,message:n,source:e}),this.offset+=e.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){const e=this.peek(1);if(this.type==="doc-end"&&e?.type!=="doc-end"){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:"doc-end",offset:this.offset,source:this.source});return}if(!e)return yield*this.stream();switch(e.type){case"document":return yield*this.document(e);case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return yield*this.scalar(e);case"block-scalar":return yield*this.blockScalar(e);case"block-map":return yield*this.blockMap(e);case"block-seq":return yield*this.blockSequence(e);case"flow-collection":return yield*this.flowCollection(e);case"doc-end":return yield*this.documentEnd(e)}yield*this.pop()}peek(e){return this.stack[this.stack.length-e]}*pop(e){const t=e??this.stack.pop();if(!t)yield{type:"error",offset:this.offset,source:"",message:"Tried to pop an empty stack"};else if(this.stack.length===0)yield t;else{const n=this.peek(1);switch(t.type==="block-scalar"?t.indent="indent"in n?n.indent:0:t.type==="flow-collection"&&n.type==="document"&&(t.indent=0),t.type==="flow-collection"&&ti(t),n.type){case"document":n.value=t;break;case"block-scalar":n.props.push(t);break;case"block-map":{const i=n.items[n.items.length-1];if(i.value){n.items.push({start:[],key:t,sep:[]}),this.onKeyLine=!0;return}else if(i.sep)i.value=t;else{Object.assign(i,{key:t,sep:[]}),this.onKeyLine=!i.explicitKey;return}break}case"block-seq":{const i=n.items[n.items.length-1];i.value?n.items.push({start:[],value:t}):i.value=t;break}case"flow-collection":{const i=n.items[n.items.length-1];!i||i.value?n.items.push({start:[],key:t,sep:[]}):i.sep?i.value=t:Object.assign(i,{key:t,sep:[]});return}default:yield*this.pop(),yield*this.pop(t)}if((n.type==="document"||n.type==="block-map"||n.type==="block-seq")&&(t.type==="block-map"||t.type==="block-seq")){const i=t.items[t.items.length-1];i&&!i.sep&&!i.value&&i.start.length>0&&Zn(i.start)===-1&&(t.indent===0||i.start.every(s=>s.type!=="comment"||s.indent<t.indent))&&(n.type==="document"?n.end=i.start:n.items.push({start:i.start}),t.items.splice(-1,1))}}}*stream(){switch(this.type){case"directive-line":yield{type:"directive",offset:this.offset,source:this.source};return;case"byte-order-mark":case"space":case"comment":case"newline":yield this.sourceToken;return;case"doc-mode":case"doc-start":{const e={type:"document",offset:this.offset,start:[]};this.type==="doc-start"&&e.start.push(this.sourceToken),this.stack.push(e);return}}yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(e){if(e.value)return yield*this.lineEnd(e);switch(this.type){case"doc-start":{Zn(e.start)!==-1?(yield*this.pop(),yield*this.step()):e.start.push(this.sourceToken);return}case"anchor":case"tag":case"space":case"comment":case"newline":e.start.push(this.sourceToken);return}const t=this.startBlockValue(e);t?this.stack.push(t):yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(e){if(this.type==="map-value-ind"){const t=ft(this.peek(2)),n=Ee(t);let i;e.end?(i=e.end,i.push(this.sourceToken),delete e.end):i=[this.sourceToken];const s={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:n,key:e,sep:i}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=s}else yield*this.lineEnd(e)}*blockScalar(e){switch(this.type){case"space":case"comment":case"newline":e.props.push(this.sourceToken);return;case"scalar":if(e.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(e){const t=e.items[e.items.length-1];switch(this.type){case"newline":if(this.onKeyLine=!1,t.value){const n="end"in t.value?t.value.end:void 0;(Array.isArray(n)?n[n.length-1]:void 0)?.type==="comment"?n?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else if(t.sep)t.sep.push(this.sourceToken);else{if(this.atIndentedComment(t.start,e.indent)){const i=e.items[e.items.length-2]?.value?.end;if(Array.isArray(i)){Array.prototype.push.apply(i,t.start),i.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return}if(this.indent>=e.indent){const n=!this.onKeyLine&&this.indent===e.indent,i=n&&(t.sep||t.explicitKey)&&this.type!=="seq-item-ind";let s=[];if(i&&t.sep&&!t.value){const o=[];for(let r=0;r<t.sep.length;++r){const a=t.sep[r];switch(a.type){case"newline":o.push(r);break;case"space":break;case"comment":a.indent>e.indent&&(o.length=0);break;default:o.length=0}}o.length>=2&&(s=t.sep.splice(o[1]))}switch(this.type){case"anchor":case"tag":i||t.value?(s.push(this.sourceToken),e.items.push({start:s}),this.onKeyLine=!0):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"explicit-key-ind":!t.sep&&!t.explicitKey?(t.start.push(this.sourceToken),t.explicitKey=!0):i||t.value?(s.push(this.sourceToken),e.items.push({start:s,explicitKey:!0})):this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case"map-value-ind":if(t.explicitKey)if(t.sep)if(t.value)e.items.push({start:[],key:null,sep:[this.sourceToken]});else if(ne(t.sep,"map-value-ind"))this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,key:null,sep:[this.sourceToken]}]});else if(ei(t.key)&&!ne(t.sep,"newline")){const o=Ee(t.start),r=t.key,a=t.sep;a.push(this.sourceToken),delete t.key,delete t.sep,this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:r,sep:a}]})}else s.length>0?t.sep=t.sep.concat(s,this.sourceToken):t.sep.push(this.sourceToken);else if(ne(t.start,"newline"))Object.assign(t,{key:null,sep:[this.sourceToken]});else{const o=Ee(t.start);this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:null,sep:[this.sourceToken]}]})}else t.sep?t.value||i?e.items.push({start:s,key:null,sep:[this.sourceToken]}):ne(t.sep,"map-value-ind")?this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const o=this.flowScalar(this.type);i||t.value?(e.items.push({start:s,key:o,sep:[]}),this.onKeyLine=!0):t.sep?this.stack.push(o):(Object.assign(t,{key:o,sep:[]}),this.onKeyLine=!0);return}default:{const o=this.startBlockValue(e);if(o){if(o.type==="block-seq"){if(!t.explicitKey&&t.sep&&!ne(t.sep,"newline")){yield*this.pop({type:"error",offset:this.offset,message:"Unexpected block-seq-ind on same line with key",source:this.source});return}}else n&&e.items.push({start:s});this.stack.push(o);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(e){const t=e.items[e.items.length-1];switch(this.type){case"newline":if(t.value){const n="end"in t.value?t.value.end:void 0;(Array.isArray(n)?n[n.length-1]:void 0)?.type==="comment"?n?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(t.start,e.indent)){const i=e.items[e.items.length-2]?.value?.end;if(Array.isArray(i)){Array.prototype.push.apply(i,t.start),i.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return;case"anchor":case"tag":if(t.value||this.indent<=e.indent)break;t.start.push(this.sourceToken);return;case"seq-item-ind":if(this.indent!==e.indent)break;t.value||ne(t.start,"seq-item-ind")?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return}if(this.indent>e.indent){const n=this.startBlockValue(e);if(n){this.stack.push(n);return}}yield*this.pop(),yield*this.step()}*flowCollection(e){const t=e.items[e.items.length-1];if(this.type==="flow-error-end"){let n;do yield*this.pop(),n=this.peek(1);while(n?.type==="flow-collection")}else if(e.end.length===0){switch(this.type){case"comma":case"explicit-key-ind":!t||t.sep?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return;case"map-value-ind":!t||t.value?e.items.push({start:[],key:null,sep:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});return;case"space":case"comment":case"newline":case"anchor":case"tag":!t||t.value?e.items.push({start:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const i=this.flowScalar(this.type);!t||t.value?e.items.push({start:[],key:i,sep:[]}):t.sep?this.stack.push(i):Object.assign(t,{key:i,sep:[]});return}case"flow-map-end":case"flow-seq-end":e.end.push(this.sourceToken);return}const n=this.startBlockValue(e);n?this.stack.push(n):(yield*this.pop(),yield*this.step())}else{const n=this.peek(2);if(n.type==="block-map"&&(this.type==="map-value-ind"&&n.indent===e.indent||this.type==="newline"&&!n.items[n.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type==="map-value-ind"&&n.type!=="flow-collection"){const i=ft(n),s=Ee(i);ti(e);const o=e.end.splice(1,e.end.length);o.push(this.sourceToken);const r={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:s,key:e,sep:o}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=r}else yield*this.lineEnd(e)}}flowScalar(e){if(this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}return{type:e,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(e){switch(this.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return this.flowScalar(this.type);case"block-scalar-header":return{type:"block-scalar",offset:this.offset,indent:this.indent,props:[this.sourceToken],source:""};case"flow-map-start":case"flow-seq-start":return{type:"flow-collection",offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case"seq-item-ind":return{type:"block-seq",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case"explicit-key-ind":{this.onKeyLine=!0;const t=ft(e),n=Ee(t);return n.push(this.sourceToken),{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:n,explicitKey:!0}]}}case"map-value-ind":{this.onKeyLine=!0;const t=ft(e),n=Ee(t);return{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:n,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(e,t){return this.type!=="comment"||this.indent<=t?!1:e.every(n=>n.type==="newline"||n.type==="space")}*documentEnd(e){this.type!=="doc-mode"&&(e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop()))}*lineEnd(e){switch(this.type){case"comma":case"doc-start":case"doc-end":case"flow-seq-end":case"flow-map-end":case"map-value-ind":yield*this.pop(),yield*this.step();break;case"newline":this.onKeyLine=!1;case"space":case"comment":default:e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop())}}};function zs(e){const t=e.prettyErrors!==!1;return{lineCounter:e.lineCounter||t&&new Rs||null,prettyErrors:t}}function ni(e,t={}){const{lineCounter:n,prettyErrors:i}=zs(t),s=new Bs(n?.addNewLine),o=new Ns(t);let r=null;for(const a of o.compose(s.parse(e),!0,e.length))if(!r)r=a;else if(r.options.logLevel!=="silent"){r.errors.push(new Pe(a.range.slice(0,2),"MULTIPLE_DOCS","Source contains multiple documents; please use YAML.parseAllDocuments()"));break}return i&&n&&(r.errors.forEach(Dn(e,n)),r.warnings.forEach(Dn(e,n))),r}function De(e,t,n){let i;typeof t=="function"?i=t:n===void 0&&t&&typeof t=="object"&&(n=t);const s=ni(e,n);if(!s)return null;if(s.warnings.forEach(o=>gn(s.options.logLevel,o)),s.errors.length>0){if(s.options.logLevel!=="silent")throw s.errors[0];s.errors=[]}return s.toJS(Object.assign({reviver:i},n))}function ii(e,t,n){let i=null;if(typeof t=="function"||Array.isArray(t)?i=t:n===void 0&&t&&(n=t),typeof n=="string"&&(n=n.length),typeof n=="number"){const s=Math.round(n);n=s<1?void 0:s>8?{indent:8}:{indent:s}}if(e===void 0){const{keepUndefined:s}=n??t??{};if(!s)return}return ge(e)&&!i?e.toString(n):new Rt(e,i,n).toString(n)}var si={"schema:ethdebug/format/data/hex":`$schema: "https://json-schema.org/draft/2020-12/schema"
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
                $sum:
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
              slot: { "$sum": ["slot", 1] }
            - name: "asset"
              location: "storage"
              slot: { "$sum": ["slot", 2] }
            - name: "amount"
              location: "storage"
              slot: { "$sum": ["slot", 3] }
            - name: "canRemit"
              location: "storage"
              slot: { "$sum": ["slot", 4] }

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
          $read: "data-pointer"
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
        $sum: [1, 2]
      example-length:
        $product: [2, $wordsize]
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

  - **Integers** are produced by a JSON-number literal, the \`$wordsize\`
    constant, a variable or lookup (\`.offset\` / \`.length\` / \`.slot\`) that
    denotes an index or count, an arithmetic operation (\`$sum\`,
    \`$difference\`, \`$product\`, \`$quotient\`, \`$remainder\`), and a
    hexadecimal literal that has an **odd** number of digits (which has no
    whole-byte width \u2014 see \`Literal\`).
  - **Bytes** are produced by a hexadecimal literal with an **even** number
    of digits (its width is the number of bytes written), \`$read\` (its
    width is the length of the region read), the resize forms
    \`$sizedN\` / \`$wordsized\` (whose width is \`N\` / the word size),
    \`$keccak256\` (width 32), and \`$concat\` (width the sum of its operands').

  ## Coercion and the width-bearing requirement

  Where an **integer** is expected \u2014 arithmetic operands, a list \`count\`, a
  segment \`slot\` / \`offset\` / \`length\` \u2014 a bytes value is accepted and read
  as the non-negative integer its bytes encode (big-endian).

  Where **bytes** are expected \u2014 the operands of \`$concat\` and \`$keccak256\`,
  whose results depend on operand widths \u2014 the operand **must** be
  width-bearing. A bare integer (a JSON number, an odd-digit hex literal,
  \`$wordsize\`, an arithmetic result, or a lookup) is **not** valid there:
  give it a width first with \`$sizedN\` or \`$wordsized\`. There is no
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
      - $wordsize

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
      result where bytes are required, give it a width with \`$sizedN\` or
      \`$wordsized\`.
    type: object
    properties:
      "$sum":
        description: |
          A list of expressions to be added together.
        $ref: "#/$defs/Operands"
      "$difference":
        description: |
          A tuple of two expressions where the second is to be subtracted from
          the first.

          If the second operand is larger than the first, the result of this
          arithmetic operation is defined to equal zero (\`0\`).

          (i.e., \`{ "$difference": [a, b] }\` equals \`a\` minus \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
      "$product":
        description: |
          A list of expressions to be multiplied.
        $ref: "#/$defs/Operands"
      "$quotient":
        description: |
          A tuple of two expressions where the first corresponds to the
          dividend and the second corresponds to the divisor, for the purposes
          of doing integer division.

          (i.e., \`{ "$quotient": [a, b] }\` equals \`a\` divided by \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
      "$remainder":
        description: |
          A tuple of two expressions where the first corresponds to the
          dividend and the second corresponds to the divisor, for the purposes
          of computing the modular-arithmetic remainder.

          (i.e., \`{ "$remainder": [a, b] }\` equals \`a\` mod \`b\`.)
        $ref: "#/$defs/Operands"
        minItems: 2
        maxItems: 2
    additionalProperties: false
    minProperties: 1
    maxProperties: 1
    examples:
      - "$sum": [5, 3, 4]
      - "$difference": [5, 3]
      - "$product": [5, 3, 0]
      - "$quotient": [5, 3]
      - "$remainder":
          - "$product":
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
      - .offset: $this

  Read:
    title: Read region bytes
    description: |
      An object of the form \`{ "$read": "<region>" }\`. The value of this
      expression equals the raw bytes present in the running machine state
      in the referenced region. The result is **bytes** whose width is the
      length of the region read.
    type: object
    properties:
      $read:
        $ref: "#/$defs/Reference"
    required:
      - $read
    additionalProperties: false
    examples:
      - $read: "struct-start"

  Reference:
    title: Region reference
    description: |
      A string value that **must** either be the \`"name"\` of at least one
      region declared with \`{ "name": "<region>" }\` previously in some root
      pointer representation, or it **must** be the literal value \`"$this"\`,
      which indicates a reference to the region containing this expression.

      If more than one region is defined with the same name, resolution is
      defined as firstly resolving to the latest earlier sibling that declares
      the matching name, then secondly resolving to the parent if it matches,
      then to parent's earlier siblings, and so on.
    type: string
    oneOf:
      - $ref: "schema:ethdebug/format/pointer/identifier"
      - const: "$this"
        description: |
          Indicates a reference to the region containing this expression.
          A property lookup via \`$this\` (e.g. \`{ ".length": "$this" }\`) must
          not be circular: the referenced property must be resolvable without
          depending on the value currently being defined.

  Keccak256:
    title: Keccak256 hash
    description: |
      An object of the form \`{ "$keccak256": [...values] }\`, indicating
      that this expression evaluates to the Solidity-style keccak256 hash
      of the tightly-packed bytes encoded by \`values\`. The result is
      **bytes** of width 32.

      Because the hash is taken over the concatenation of the operands'
      bytes, each operand **must** be width-bearing (bytes): a bare integer
      is not valid here and must be given a width first with \`$sizedN\` or
      \`$wordsized\`. This is why a mapping-slot computation word-sizes its key
      and slot before hashing.
    type: object
    properties:
      $keccak256:
        title: Array of hashed values
        type: array
        items:
          $ref: "schema:ethdebug/format/pointer/expression"
    additionalProperties: false
    required:
      - $keccak256
    examples:
      - $keccak256:
          - $wordsized: 0
          - "0x00"

  Concat:
    title: Concatenate values
    description: |
      An object of the form \`{ "$concat": [...values] }\`, indicating that this
      expression evaluates to the concatenation of bytes from each value.
      The byte width of each operand is preserved; no padding is added or
      removed between operands. The result is **bytes** whose width is the
      sum of the operand widths.

      Each operand **must** be width-bearing (bytes): a bare integer is not
      valid here and must be given a width first with \`$sizedN\` or
      \`$wordsized\`.
    type: object
    properties:
      $concat:
        title: Array of values to concatenate
        type: array
        items:
          $ref: "schema:ethdebug/format/pointer/expression"
    additionalProperties: false
    required:
      - $concat
    examples:
      - $concat:
          - "0x00"
          - "0x00"
      - $concat:
          - "0xdead"
          - "0xbeef"
      - $concat: []

  Resize:
    title: Resize data
    description: |
      A resize operation produces **bytes** of a definite width, and is the
      bridge from an integer to bytes: give it an integer (or bytes) and it
      yields bytes of the requested width.

      A resize operation expression is either an object of the form
      \`{ "$sized<N>": <expression> }\` or an object of the form
      \`{ "$wordsized": <expression> }\`, where \`<expression>\` is an expression
      whose value is to be resized, and, if applicable, where \`<N>\` is the
      smallest decimal representation of an unsigned integer.

      This object's value is evaluated as follows, based on the bytes width of
      the value \`<expression>\` evaluates to and based on \`<N>\` (using the
      value of \`"$wordsize"\` for \`<N>\` in the case of the latter form above):
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
          "^\\\\$sized([1-9]+[0-9]*)$":
            $ref: "schema:ethdebug/format/pointer/expression"
        additionalProperties: false
      - title: Resize to word-size
        type: object
        patternProperties:
          "^\\\\$wordsized$":
            $ref: "schema:ethdebug/format/pointer/expression"
        additionalProperties: false
    minProperties: 1
    maxProperties: 1
    examples:
      - $sized2: "0x00" # 0x0000
      - $sized2: "0xffffff" # 0xffff
      - $wordsized: "0x00" # 0x0000000000000000000000000000000000000000000000000000000000000000

examples:
  - 0
  - $sum:
      - .offset: "array-start"
      - .length: "array-start"
      - 1
  - $keccak256:
      - $wordsized: 5
      - $wordsized:
          .offset: "array-start"
`,"schema:ethdebug/format/pointer/identifier":`$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/identifier"

title: ethdebug/format/pointer/identifier
description: |
  An identifier for use within the context of a root pointer
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
      $product:
        - $wordsize
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
      $product:
        - $wordsize
        - 2
  - location: storage
    slot: "0x08"
    offset:
      $quotient:
        - $wordsize
        - 2
    length:
      $quotient:
        - $wordsize
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
      $product:
        - $wordsize
        - 2
  - location: transient
    slot: "0x08"
    offset:
      $quotient:
        - $wordsize
        - 2
    length:
      $quotient:
        - $wordsize
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
  \`p\` (i.e., \`{ "offset": "$wordsize" }\`) is interpreted as the first byte of
  slot \`p + 1\`.

type: object

properties:
  slot:
    $ref: "schema:ethdebug/format/pointer/expression"
  offset:
    description: |
      The starting byte index within the slot.

      Bytes within a slot are numbered from the most significant byte. A
      slot's value is its \`$wordsize\`-byte big-endian word, and byte \`0\` is
      the first byte of that word, as if the word were written to memory. An
      \`offset\` of \`0\` therefore addresses the most significant byte of the
      slot, and an \`offset\` of \`$wordsize - 1\` addresses the least
      significant byte.

      This field is **optional**. If unspecified, it has the default value of
      \`0\`, indicating that the segment begins at the start of the specified
      slot (its most significant byte).

      A data layout that counts bytes from the low-order end of a slot must
      convert: a value of \`n\` bytes that sits \`o\` bytes from the low-order end
      is at \`offset\` \`$wordsize - o - n\`. An emitter may write that number as
      a literal, which is the simplest form to read and resolve. It may also
      write the conversion as an expression, such as

      \`\`\`json
      {
        "$difference": ["$wordsize", { "$sum": [o, { ".length": "$this" }] }]
      }
      \`\`\`

      which can take \`n\` from the region's own \`length\`, keeps the layout's
      own numbers visible, needs no arithmetic in the emitter, and does not
      depend on a fixed word size.

      This field's expression must resolve to a non-negative value. It is
      **not** bounded by the word size: an offset that meets or exceeds
      \`$wordsize\` carries into subsequent slots. Given a \`slot\` value \`p\`
      and an \`offset\` value \`n\`, the segment begins at byte
      \`n mod $wordsize\` of slot \`p + floor(n / $wordsize)\`. (Equivalently,
      byte \`{ "offset": "$wordsize" }\` of slot \`p\` is byte \`0\` of slot
      \`p + 1\`, consistent with the multi-slot note above.) Emitters may
      therefore chain byte sums across a slot boundary without decomposing
      into slot and byte components themselves; a resolver recovers the
      effective slot and byte by division and remainder against
      \`$wordsize\`.
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
      $difference:
        - $wordsize
        - $remainder:
            - .offset: $this
            - $wordsize

required:
  - slot

examples:
  - slot: 0
  - slot: 1
    length:
      $product:
        - $wordsize
        - 3
  # a carry example: an offset at or beyond \`$wordsize\` addresses a later
  # slot. Here \`offset: $wordsize\` is byte 0 of slot 1, so this segment is
  # the 4 bytes beginning there.
  - slot: 0
    offset: $wordsize
    length: 4
  # packed values: an \`address\` (20 bytes) at the low-order end of slot 2,
  # and a \`uint32\` (4 bytes) just above it, written with literal offsets
  - slot: 2
    offset: 12
    length: 20
  - slot: 2
    offset: 8
    length: 4
  # the same two values with the conversion \`$wordsize - (o + n)\` written as
  # an expression that takes \`n\` from the region's own length
  - slot: 2
    offset:
      $difference:
        - $wordsize
        - .length: $this
    length: 20
  - slot: 2
    offset:
      $difference:
        - $wordsize
        - $sum:
            - 20
            - .length: $this
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
            $read: "array-start"
          length: $wordsize

        # thirdly, declare a sub-pointer that is a dynamic list whose size is
        # indicated by the value at "array-count", where each "item-index"
        # corresponds to a discrete "array-item" region
        - list:
            count:
              $read: "array-count"
            each: "item-index"
            is:
              name: "array-item"
              location: "memory"
              offset:
                # array items are positioned so that the item with index 0
                # immediately follows "array-count", and each subsequent item
                # immediately follows the previous.
                $sum:
                  - .offset: "array-count"
                  - .length: "array-count"
                  - $product:
                      - "item-index"
                      - .length: $this
              length: $wordsize

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
            $difference: ["previous", "size"]
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
            offset: $wordsize
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
          $read: "array-start"
        length: $wordsize

      # declare this to include a list of pointers of size indicated by the
      # value at "array-count", where each "item-index" corresponds to a
      # group of pointers
      - list:
          count:
            $read: "array-count"
          each: "item-index"
          is:
            group:
              # each element in the list includes a "struct-pointer" region
              # in memory (laid out sequentially in a block as the raw
              # array data)
              - name: "struct-pointer"
                location: memory
                offset:
                  $sum:
                    - .offset: "array-count"
                    - .length: "array-count"
                    - $product:
                        - "item-index"
                        - .length: $this
                length: $wordsize

              # following that pointer leads to the region corresponding to
              # the first member of the struct
              - name: "struct-member-0"
                location: memory
                offset:
                  $read: "struct-pointer"
                length: $wordsize

              # the second struct member immediately follows the first
              - name: "struct-member-1"
                location: memory
                offset:
                  $sum:
                    - .offset: "struct-member-0"
                    - .length: "struct-member-0"
                length: $wordsize

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
            $difference: [$wordsize, 1]
          length: 1

        # define the region representing the string data itself conditionally
        # based on odd or even length data
        - if:
            $remainder:
              - $sum:
                  - $read: "length-flag"
                  - 1
              - 2

          # short string case (flag is even)
          then:
            define:
              "string-length":
                $quotient: [{ $read: "length-flag" }, 2]
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
                length: $wordsize

              - define:
                  "string-length":
                    $quotient:
                      - $difference:
                          - $read: "long-string-length-data"
                          - 1
                      - 2

                  "start-slot":
                    $keccak256:
                      - $wordsized: "string-storage-contract-variable-slot"

                  "total-slots":
                    # account for both zero and nonzero slot remainders by adding
                    # $wordsize-1 to the length before dividing
                    $quotient:
                      - $sum: ["string-length", { $difference: [$wordsize, 1] }]
                      - $wordsize
                in:
                  list:
                    count: "total-slots"
                    each: "i"
                    is:
                      define:
                        "current-slot":
                          $sum: ["start-slot", "i"]
                        "previous-length":
                          $product: ["i", $wordsize]
                      in:
                        # conditional based on whether this is the last slot:
                        # is the string length longer than the previous length
                        # plus this whole slot?
                        if:
                          $difference:
                            - "string-length"
                            - $sum: ["previous-length", "$wordsize"]
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
                            $difference: ["string-length", "previous-length"]

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
          length: $wordsize

        - define:
            "string-length":
              $quotient:
                - $difference:
                    - $read: "long-string-length-data"
                    - 1
                - 2

            "start-slot":
              $keccak256:
                - $wordsized: "string-storage-slot"
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
`},Me={merge:!0};function Ds({schema:e,pointer:t}){if(typeof t=="string"&&!t.startsWith("#"))throw new Error("`pointer` option must start with '#'");const n=t?{pointer:t}:{};return Vs(e)?Ms({schema:typeof e=="object"?e:{id:e},...n}):Js(e)?Ks({schema:e,...n}):Us({schema:e,...n})}function Ms({schema:{id:e},pointer:t}){const[n,i]=e.split("#"),s=i?Fs([`#${i}`,t]):t,o=si[n];if(!o)throw new Error(`Unknown schema with $id "${n}"`);const r=Jt(o,s),a=De(r,Me),c=De(o,Me);return{id:n,...s?{pointer:s}:{},yaml:r,schema:a,rootSchema:c}}function Ks({schema:{yaml:e},pointer:t}){const n=Jt(e,t),i=De(n,Me),s=De(e,Me),o=i.$id;return o?{id:o,...t?{pointer:t}:{},yaml:n,schema:i,rootSchema:s}:{...t?{pointer:t}:{},yaml:n,schema:i,rootSchema:s}}function Us({schema:e,pointer:t}){const n=ii(e),i=Jt(n,t),s=De(i,Me),o=s.$id;return o?{id:o,...t?{pointer:t}:{},yaml:i,schema:s,rootSchema:e}:{...t?{pointer:t}:{},yaml:i,schema:s,rootSchema:e}}function Fs(e){const t=e.filter(n=>typeof n=="string").map(n=>n.slice(1)).join("");if(t.length!==0)return`#${t}`}function Jt(e,t){if(!t)return e;let n=ni(e);for(const i of t.slice(2).split("/"))if(n=n.get(i,!0),!n)throw new Error(`Pointer ${t} not found in schema`);return ii(n)}function Vs(e){return typeof e=="string"||Object.keys(e).length===1&&"id"in e}function Js(e){return typeof e=="object"&&Object.keys(e).length===1&&"yaml"in e}var Hs=Object.keys(si),co=Hs.map(e=>({[e]:Ds({schema:{id:e}}).schema})).reduce((e,t)=>({...e,...t}),{}),Ws="0.1.0-draft.1",le;(e=>{e.isValue=n=>[e.isUnsigned,e.isHex].some(i=>i(n)),e.isUnsigned=n=>typeof n=="number"&&n>=0;const t=new RegExp(/^0x[0-9a-fA-F]{1,}$/);e.isHex=n=>typeof n=="string"&&t.test(n),e.stamp=(n,i)=>({ethdebug:{schema:n,version:Ws},...i}),e.versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/,e.isStamp=n=>typeof n=="object"&&!!n&&"schema"in n&&typeof n.schema=="string"&&"version"in n&&typeof n.version=="string"&&e.versionPattern.test(n.version)&&Object.keys(n).length===2})(le||(le={}));var fe;(e=>{e.isId=n=>["number","string"].includes(typeof n),e.isReference=n=>typeof n=="object"&&!!n&&"id"in n&&(0,e.isId)(n.id);function t(n){return{id:n.id,...[[e.isCompilation,"compilation"],[e.isSource,"source"]].filter(([i])=>i(n)).map(([i,s])=>({type:s}))[0]||{}}}e.toReference=t,e.isCompilation=n=>typeof n=="object"&&!!n&&"id"in n&&(0,e.isId)(n.id)&&"compiler"in n&&typeof n.compiler=="object"&&!!n.compiler&&"name"in n.compiler&&typeof n.compiler.name=="string"&&"version"in n.compiler&&typeof n.compiler.version=="string"&&"sources"in n&&Array.isArray(n.sources)&&n.sources.every(e.isSource),e.isSource=n=>typeof n=="object"&&!!n&&"id"in n&&(0,e.isId)(n.id)&&"path"in n&&typeof n.path=="string"&&"contents"in n&&typeof n.contents=="string"&&"language"in n&&typeof n.language=="string"&&(!("encoding"in n)||typeof n.encoding=="string"),e.isSourceRange=n=>typeof n=="object"&&!!n&&"source"in n&&(0,e.isReference)(n.source)&&(!("range"in n)||typeof n.range=="object"&&!!n.range&&"offset"in n.range&&le.isValue(n.range.offset)&&"length"in n.range&&le.isValue(n.range.length))&&(!("compilation"in n)||(0,e.isReference)(n.compilation))})(fe||(fe={}));var ri={};Ci(ri,{isComplex:()=>ci,isElementary:()=>ai,isType:()=>oi,isWrapper:()=>ht});var oi=e=>[ai,ci].some(t=>t(e)),ai=e=>typeof e=="object"&&!!e&&"kind"in e&&typeof e.kind=="string"&&(!("class"in e)||e.class==="elementary")&&!("contains"in e),ci=e=>typeof e=="object"&&!!e&&"kind"in e&&typeof e.kind=="string"&&(!("class"in e)||e.class==="complex")&&"contains"in e&&!!e.contains&&(ht(e.contains)||Array.isArray(e.contains)&&e.contains.every(ht)||typeof e.contains=="object"&&Object.values(e.contains).every(ht)),ht=e=>typeof e=="object"&&!!e&&"type"in e&&(oi(e.type)||typeof e.type=="object"&&!!e.type&&"id"in e.type),Gs=e=>ie.hasElementaryKind(e)||ie.hasComplexKind(e)?ie.isKnown(e):ie.isUnknown(e),ie;(e=>{e.Base=ri,e.isKnown=i=>[e.isElementary,e.isComplex].some(s=>s(i)),e.isUnknown=i=>e.Base.isType(i)&&"class"in i&&(!("contains"in i)||e.isWrapper(i.contains)||Array.isArray(i.contains)&&i.contains.every(e.isWrapper)||typeof i.contains=="object"&&Object.values(i.contains).every(e.isWrapper)),e.isReference=i=>typeof i=="object"&&!!i&&"id"in i&&(typeof i.id=="string"||typeof i.id=="number"),e.isSpecifier=i=>Gs(i)||(0,e.isReference)(i),e.isWrapper=i=>typeof i=="object"&&!!i&&"type"in i&&(0,e.isSpecifier)(i.type),e.hasElementaryKind=i=>typeof i=="object"&&!!i&&"kind"in i&&typeof i.kind=="string"&&["uint","int","ufixed","fixed","bool","bytes","string","address","contract","enum"].includes(i.kind),e.isElementary=i=>[t.isUint,t.isInt,t.isUfixed,t.isFixed,t.isBool,t.isBytes,t.isString,t.isAddress,t.isContract,t.isEnum].some(s=>s(i));let t;(i=>{i.isUint=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"uint")&&"bits"in s&&typeof s.bits=="number"&&s.bits>=8&&s.bits<=256&&s.bits%8===0,i.isInt=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"int")&&"bits"in s&&typeof s.bits=="number"&&s.bits>=8&&s.bits<=256&&s.bits%8===0,i.isUfixed=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"ufixed")&&"bits"in s&&typeof s.bits=="number"&&s.bits>=8&&s.bits<=256&&s.bits%8===0&&"places"in s&&typeof s.places=="number"&&s.places>=1&&s.places<=80,i.isFixed=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"fixed")&&"bits"in s&&typeof s.bits=="number"&&s.bits>=8&&s.bits<=256&&s.bits%8===0&&"places"in s&&typeof s.places=="number"&&s.places>=1&&s.places<=80,i.isBool=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"bool"),i.isBytes=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"bytes")&&(!("size"in s)||le.isUnsigned(s.size)),i.isString=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"string")&&(!("encoding"in s)||typeof s.encoding=="string"),i.isAddress=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"address")&&(!("payable"in s)||typeof s.payable=="boolean"),i.isContract=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"contract")&&(!("payable"in s)||typeof s.payable=="boolean")&&(!("library"in s)||typeof s.library=="boolean")&&(!("interface"in s)||typeof s.interface=="boolean")&&!("library"in s&&s.library===!0&&"interface"in s&&s.interface===!0)&&(!("definition"in s)||(0,e.isDefinition)(s.definition)),i.isEnum=s=>typeof s=="object"&&!!s&&P(s,"elementary")&&R(s,"enum")&&"values"in s&&Array.isArray(s.values)&&(!("definition"in s)||(0,e.isDefinition)(s.definition))})(t=e.Elementary||(e.Elementary={})),e.hasComplexKind=i=>typeof i=="object"&&!!i&&"kind"in i&&typeof i.kind=="string"&&["alias","tuple","array","mapping","struct"].includes(i.kind),e.isComplex=i=>[n.isAlias,n.isTuple,n.isArray,n.isMapping,n.isStruct].some(s=>s(i));let n;(i=>{i.isAlias=s=>typeof s=="object"&&!!s&&P(s,"complex")&&R(s,"alias")&&"contains"in s&&(0,e.isWrapper)(s.contains)&&(!("definition"in s)||(0,e.isDefinition)(s.definition)),i.isTuple=s=>typeof s=="object"&&!!s&&P(s,"complex")&&R(s,"tuple")&&"contains"in s&&Array.isArray(s.contains)&&s.contains.every(o=>(0,e.isWrapper)(o)&&(!("name"in o)||typeof o.name=="string")),i.isArray=s=>typeof s=="object"&&!!s&&P(s,"complex")&&R(s,"array")&&"contains"in s&&(0,e.isWrapper)(s.contains),i.isMapping=s=>typeof s=="object"&&!!s&&P(s,"complex")&&R(s,"mapping")&&"contains"in s&&typeof s.contains=="object"&&!!s.contains&&"key"in s.contains&&(0,e.isWrapper)(s.contains.key)&&"value"in s.contains&&(0,e.isWrapper)(s.contains.value),i.isStruct=s=>typeof s=="object"&&!!s&&P(s,"complex")&&R(s,"struct")&&"contains"in s&&Array.isArray(s.contains)&&s.contains.every(o=>(0,e.isWrapper)(o)&&(!("name"in o)||typeof o.name=="string"))&&(!("definition"in s)||(0,e.isDefinition)(s.definition))})(n=e.Complex||(e.Complex={})),e.isDefinition=i=>typeof i=="object"&&!!i&&(!("name"in i)||typeof i.name=="string")&&(!("location"in i)||fe.isSourceRange(i.location))&&(Object.keys(i).includes("name")||Object.keys(i).includes("location"))})(ie||(ie={}));var P=(e,t)=>!("class"in e)||e.class===t,R=(e,t)=>"kind"in e&&e.kind===t,Q=e=>[S.isRegion,S.isCollection].some(t=>t(e)),S;(e=>{e.isIdentifier=o=>typeof o=="string"&&/^[a-zA-Z_-]+[a-zA-Z0-9$_-]*$/.test(o),e.isRegion=o=>[t.isStack,t.isMemory,t.isStorage,t.isCalldata,t.isReturndata,t.isTransient,t.isCode].some(r=>r(o));let t;(o=>{o.isBase=r=>!!r&&typeof r=="object"&&(!("name"in r)||typeof r.name=="string")&&"location"in r&&typeof r.location=="string",o.isStack=r=>(0,o.isBase)(r)&&n.isSegment(r)&&r.location==="stack",o.isMemory=r=>(0,o.isBase)(r)&&n.isSlice(r)&&r.location==="memory",o.isStorage=r=>(0,o.isBase)(r)&&n.isSegment(r)&&r.location==="storage",o.isCalldata=r=>(0,o.isBase)(r)&&n.isSlice(r)&&r.location==="calldata",o.isReturndata=r=>(0,o.isBase)(r)&&n.isSlice(r)&&r.location==="returndata",o.isTransient=r=>(0,o.isBase)(r)&&n.isSegment(r)&&r.location==="transient",o.isCode=r=>(0,o.isBase)(r)&&n.isSlice(r)&&r.location==="code"})(t=e.Region||(e.Region={}));let n;(o=>{o.isSegment=r=>!!r&&typeof r=="object"&&"slot"in r&&(0,e.isExpression)(r.slot)&&(!("offset"in r)||(0,e.isExpression)(r.offset))&&(!("length"in r)||(0,e.isExpression)(r.length)),o.isSlice=r=>!!r&&typeof r=="object"&&"offset"in r&&(0,e.isExpression)(r.offset)&&"length"in r&&(0,e.isExpression)(r.length)})(n=e.Scheme||(e.Scheme={})),e.isCollection=o=>[i.isGroup,i.isList,i.isConditional,i.isScope,i.isReference,i.isTemplates].some(r=>r(o));let i;(o=>{o.isGroup=r=>!!r&&typeof r=="object"&&Object.keys(r).length===1&&"group"in r&&Array.isArray(r.group)&&r.group.length>=1&&r.group.every(Q),o.isList=r=>!!r&&typeof r=="object"&&Object.keys(r).length===1&&"list"in r&&!!r.list&&typeof r.list=="object"&&Object.keys(r.list).length===3&&"count"in r.list&&(0,e.isExpression)(r.list.count)&&"each"in r.list&&(0,e.isIdentifier)(r.list.each)&&"is"in r.list&&Q(r.list.is),o.isConditional=r=>!!r&&typeof r=="object"&&"if"in r&&(0,e.isExpression)(r.if)&&"then"in r&&Q(r.then)&&(!("else"in r)||Q(r.else)),o.isScope=r=>!!r&&typeof r=="object"&&"define"in r&&typeof r.define=="object"&&!!r.define&&Object.keys(r.define).every(a=>(0,e.isIdentifier)(a))&&"in"in r&&Q(r.in),o.isReference=r=>!!r&&typeof r=="object"&&"template"in r&&typeof r.template=="string"&&!!r.template&&(!("yields"in r)||typeof r.yields=="object"&&r.yields!==null&&Object.entries(r.yields).every(([a,c])=>(0,e.isIdentifier)(a)&&(0,e.isIdentifier)(c))),o.isTemplates=r=>!!r&&typeof r=="object"&&"templates"in r&&typeof r.templates=="object"&&!!r.templates&&Object.keys(r.templates).every(e.isIdentifier)&&Object.values(r.templates).every(e.isTemplate)&&"in"in r&&Q(r.in)})(i=e.Collection||(e.Collection={})),e.isExpression=o=>[s.isLiteral,s.isConstant,s.isVariable,s.isArithmetic,s.isLookup,s.isRead,s.isKeccak256,s.isConcat,s.isResize].some(r=>r(o));let s;(o=>{o.isLiteral=f=>typeof f=="number"||typeof f=="string"&&/^0x[0-9a-fA-F]+$/.test(f),o.isConstant=f=>typeof f=="string"&&["$wordsize"].includes(f),o.isVariable=f=>(0,e.isIdentifier)(f),o.isArithmetic=f=>[a.isSum,a.isDifference,a.isProduct,a.isQuotient,a.isRemainder].some(h=>h(f));const r=(f,h)=>d=>!!d&&typeof d=="object"&&Object.keys(d).length===1&&f in d&&h(d[f]);o.isOperands=f=>Array.isArray(f)&&f.every(e.isExpression);let a;(f=>{f.isTwoOperands=h=>(0,o.isOperands)(h)&&h.length===2,f.isSum=r("$sum",o.isOperands),f.isDifference=r("$difference",f.isTwoOperands),f.isProduct=r("$product",o.isOperands),f.isQuotient=r("$quotient",f.isTwoOperands),f.isRemainder=r("$remainder",f.isTwoOperands)})(a=o.Arithmetic||(o.Arithmetic={})),o.isReference=f=>(0,e.isIdentifier)(f)||f==="$this",o.isLookup=f=>[c.isOffset,c.isLength,c.isSlot].some(h=>h(f));let c;(f=>{f.propertyFrom=h=>h.slice(1),f.isOffset=r(".offset",o.isReference),f.isLength=r(".length",o.isReference),f.isSlot=r(".slot",o.isReference)})(c=o.Lookup||(o.Lookup={})),o.isRead=r("$read",o.isReference),o.isKeccak256=r("$keccak256",o.isOperands),o.isConcat=r("$concat",o.isOperands),o.isResize=f=>[l.isToWordsize,l.isToNumber].some(h=>h(f));let l;(f=>{f.isToNumber=h=>{if(!h||typeof h!="object"||Object.keys(h).length!==1)return!1;const[d]=Object.keys(h);return typeof d=="string"&&/^\$sized([1-9]+[0-9]*)$/.test(d)},f.isToWordsize=h=>!!h&&typeof h=="object"&&Object.keys(h).length===1&&"$wordsized"in h&&typeof h.$wordsized<"u"&&(0,e.isExpression)(h.$wordsized)})(l=o.Resize||(o.Resize={}))})(s=e.Expression||(e.Expression={})),e.isTemplates=o=>!!o&&typeof o=="object"&&Object.keys(o).every(e.isIdentifier)&&Object.values(o).every(e.isTemplate),e.isTemplate=o=>!!o&&typeof o=="object"&&Object.keys(o).length===2&&"expect"in o&&Array.isArray(o.expect)&&o.expect.every(e.isIdentifier)&&"for"in o&&Q(o.for)})(S||(S={}));var dt=e=>[z.isName,z.isCode,z.isVariables,z.isRemark,z.isPick,z.isFrame,z.isGather,z.isInvoke,z.isReturn,z.isRevert,z.isTransform].some(t=>t(e)),z;(e=>{e.isName=r=>typeof r=="object"&&!!r&&"name"in r&&typeof r.name=="string",e.isCode=r=>typeof r=="object"&&!!r&&"code"in r&&fe.isSourceRange(r.code),e.isVariables=r=>typeof r=="object"&&!!r&&"variables"in r&&Array.isArray(r.variables)&&r.variables.length>0&&r.variables.every(t.isVariable);let t;(r=>{const a=new Set(["identifier","declaration","type","pointer"]);r.isVariable=c=>typeof c=="object"&&!!c&&Object.keys(c).length>0&&Object.keys(c).every(l=>a.has(l))&&(!("identifier"in c)||typeof c.identifier=="string")&&(!("declaration"in c)||fe.isSourceRange(c.declaration))&&(!("type"in c)||ie.isSpecifier(c.type))&&(!("pointer"in c)||Q(c.pointer))})(t=e.Variables||(e.Variables={})),e.isRemark=r=>typeof r=="object"&&!!r&&"remark"in r&&typeof r.remark=="string",e.isPick=r=>typeof r=="object"&&!!r&&"pick"in r&&Array.isArray(r.pick)&&r.pick.every(dt),e.isGather=r=>typeof r=="object"&&!!r&&"gather"in r&&Array.isArray(r.gather)&&r.gather.every(dt),e.isFrame=r=>typeof r=="object"&&!!r&&"frame"in r&&typeof r.frame=="string";let n;(r=>{r.isIdentity=a=>typeof a=="object"&&!!a&&(!("identifier"in a)||typeof a.identifier=="string")&&(!("declaration"in a)||fe.isSourceRange(a.declaration))&&(!("type"in a)||ie.isSpecifier(a.type)),r.isPointerRef=a=>typeof a=="object"&&!!a&&"pointer"in a&&Q(a.pointer)})(n=e.Function||(e.Function={})),e.isInvoke=r=>typeof r=="object"&&!!r&&"invoke"in r&&i.isInvocation(r.invoke);let i;(r=>{r.isInvocation=c=>n.isIdentity(c)&&(!("activation"in c)||typeof c.activation=="string")&&(a.isInternalCall(c)||a.isExternalCall(c)||a.isContractCreation(c));let a;(c=>{c.isInternalCall=l=>typeof l=="object"&&!!l&&"jump"in l&&l.jump===!0&&(!("target"in l)||n.isPointerRef(l.target))&&(!("arguments"in l)||n.isPointerRef(l.arguments)),c.isExternalCall=l=>typeof l=="object"&&!!l&&"message"in l&&l.message===!0&&"target"in l&&n.isPointerRef(l.target)&&(!("gas"in l)||n.isPointerRef(l.gas))&&(!("value"in l)||n.isPointerRef(l.value))&&(!("input"in l)||n.isPointerRef(l.input))&&(!("delegate"in l)||l.delegate===!0)&&(!("static"in l)||l.static===!0),c.isContractCreation=l=>typeof l=="object"&&!!l&&"create"in l&&l.create===!0&&(!("value"in l)||n.isPointerRef(l.value))&&(!("salt"in l)||n.isPointerRef(l.salt))&&(!("input"in l)||n.isPointerRef(l.input))})(a=r.Invocation||(r.Invocation={}))})(i=e.Invoke||(e.Invoke={})),e.isReturn=r=>typeof r=="object"&&!!r&&"return"in r&&s.isInfo(r.return);let s;(r=>{r.isInfo=a=>n.isIdentity(a)&&typeof a=="object"&&!!a&&(!("data"in a)||n.isPointerRef(a.data))&&(!("success"in a)||n.isPointerRef(a.success))&&(!("activation"in a)||typeof a.activation=="string")})(s=e.Return||(e.Return={})),e.isRevert=r=>typeof r=="object"&&!!r&&"revert"in r&&o.isInfo(r.revert);let o;(r=>{r.isInfo=a=>n.isIdentity(a)&&typeof a=="object"&&!!a&&(!("reason"in a)||n.isPointerRef(a.reason))&&(!("panic"in a)||typeof a.panic=="number")&&(!("activation"in a)||typeof a.activation=="string")})(o=e.Revert||(e.Revert={})),e.isTransform=r=>typeof r=="object"&&!!r&&"transform"in r&&Array.isArray(r.transform)&&r.transform.length>0&&r.transform.every(a=>typeof a=="string"&&a.length>0)})(z||(z={}));var Ys=e=>typeof e=="object"&&!!e&&"offset"in e&&le.isValue(e.offset)&&(!("context"in e)||dt(e.context))&&(!("operation"in e)||pt.isOperation(e.operation)),pt;(e=>{e.isOperation=t=>typeof t=="object"&&!!t&&"mnemonic"in t&&typeof t.mnemonic=="string"&&(!("arguments"in t)||Array.isArray(t.arguments)&&t.arguments.every(le.isValue))})(pt||(pt={}));var li;(e=>{e.Context=z,e.isContext=dt,e.Instruction=pt,e.isInstruction=Ys,e.isEnvironment=t=>typeof t=="string"&&["call","create"].includes(t),e.isContract=t=>typeof t=="object"&&!!t&&"definition"in t&&fe.isSourceRange(t.definition)&&(!("name"in t)||typeof t.name=="string")})(li||(li={}));function Ke(e){if(!Number.isSafeInteger(e)||e<0)throw new Error(`positive integer expected, not ${e}`)}function Qs(e){if(typeof e!="boolean")throw new Error(`boolean expected, not ${e}`)}function Xs(e){return e instanceof Uint8Array||e!=null&&typeof e=="object"&&e.constructor.name==="Uint8Array"}function Ue(e,...t){if(!Xs(e))throw new Error("Uint8Array expected");if(t.length>0&&!t.includes(e.length))throw new Error(`Uint8Array expected of length ${t}, not of length=${e.length}`)}function Zs(e){if(typeof e!="function"||typeof e.create!="function")throw new Error("Hash should be wrapped by utils.wrapConstructor");Ke(e.outputLen),Ke(e.blockLen)}function Ht(e,t=!0){if(e.destroyed)throw new Error("Hash instance has been destroyed");if(t&&e.finished)throw new Error("Hash#digest() has already been called")}function fi(e,t){Ue(e);const n=t.outputLen;if(e.length<n)throw new Error(`digestInto() expects output buffer of length at least ${n}`)}var er={number:Ke,bool:Qs,bytes:Ue,hash:Zs,exists:Ht,output:fi},Wt=er,tr=e=>new Uint32Array(e.buffer,e.byteOffset,Math.floor(e.byteLength/4)),hi=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68,nr=e=>e<<24&4278190080|e<<8&16711680|e>>>8&65280|e>>>24&255;function di(e){for(let t=0;t<e.length;t++)e[t]=nr(e[t])}var ir=Array.from({length:256},(e,t)=>t.toString(16).padStart(2,"0"));function sr(e){Ue(e);let t="";for(let n=0;n<e.length;n++)t+=ir[e[n]];return t}function rr(e){if(typeof e!="string")throw new Error(`utf8ToBytes expected string, got ${typeof e}`);return new Uint8Array(new TextEncoder().encode(e))}function Gt(e){return typeof e=="string"&&(e=rr(e)),Ue(e),e}var or=class{clone(){return this._cloneInto()}},lo={}.toString;function ar(e){const t=i=>e().update(Gt(i)).digest(),n=e();return t.outputLen=n.outputLen,t.blockLen=n.blockLen,t.create=()=>e(),t}function cr(e){const t=(i,s)=>e(s).update(Gt(i)).digest(),n=e({});return t.outputLen=n.outputLen,t.blockLen=n.blockLen,t.create=i=>e(i),t}var fo=Wt.bool,ho=Wt.bytes;function ut(e){return t=>(Wt.bytes(t),e(t))}var po=(()=>{const e=typeof globalThis=="object"&&"crypto"in globalThis?globalThis.crypto:void 0,t=typeof module<"u"&&typeof module.require=="function"&&module.require.bind(module);return{node:t&&!e?t("crypto"):void 0,web:e}})(),lr=Symbol.for("nodejs.util.inspect.custom"),D=class Z extends Uint8Array{static zero(){return new Z([])}static fromUint(t){if(t===0n)return this.zero();const n=Math.ceil(Number(t.toString(2).length)/8),i=new Uint8Array(n);for(let s=n-1;s>=0;s--)i[s]=Number(t&0xffn),t>>=8n;return new Z(i)}static fromNumber(t){const n=Math.ceil(Math.log2(t+1)/8),i=new Uint8Array(n);for(let s=n-1;s>=0;s--)i[s]=t&255,t>>=8;return new Z(i)}static fromHex(t){if(!t.startsWith("0x"))throw new Error('Invalid hex string format. Expected "0x" prefix.');const n=new Uint8Array((t.length-2)/2+.5);for(let i=2;i<t.length;i+=2)n[i/2-1]=parseInt(t.slice(i,i+2),16);return new Z(n)}static fromBytes(t){return new Z(t)}asUint(){const t=8n;let n=0n;for(const i of this.values()){const s=BigInt(i);n=(n<<t)+s}return n}toHex(){return`0x${sr(this)}`}padUntilAtLeast(t){if(this.length>=t)return this;const n=new Uint8Array(t);return n.set(this,t-this.length),Z.fromBytes(n)}resizeTo(t){if(this.length===t)return this;const n=new Uint8Array(t);return this.length<t?n.set(this,t-this.length):n.set(this.slice(this.length-t)),Z.fromBytes(n)}concat(...t){const n=[this,...t].map(i=>i.toHex().slice(2)).reduce((i,s)=>`${i}${s}`,"0x");return Z.fromHex(n)}inspect(t,n,i){return`Data[${n.stylize(this.toHex(),"number")}]`}[lr](t,n,i){return this.inspect(t,n,i)}};async function Yt(e,t){const{location:n}=e,{state:i}=t;switch(n){case"stack":{const{slot:s,offset:o,length:r}=de(["slot","offset","length"],e);return await Qt({offset:o,length:r},(a,c)=>i.stack.peek({depth:s+a,slice:c}))}case"memory":{const{offset:s,length:o}=de(["offset","length"],e);return await i.memory.read({slice:{offset:s,length:o}})}case"storage":{const{slot:s}=e,{offset:o,length:r}=de(["offset","length"],e);return await Qt({offset:o,length:r},(a,c)=>i.storage.read({slot:pi(s,a),slice:c}))}case"calldata":{const{offset:s,length:o}=de(["offset","length"],e);return await i.calldata.read({slice:{offset:s,length:o}})}case"returndata":{const{offset:s,length:o}=de(["offset","length"],e);return await i.returndata.read({slice:{offset:s,length:o}})}case"transient":{const{slot:s}=e,{offset:o,length:r}=de(["offset","length"],e);return await Qt({offset:o,length:r},(a,c)=>i.transient.read({slot:pi(s,a),slice:c}))}case"code":{const{offset:s,length:o}=de(["offset","length"],e);return await i.code.read({slice:{offset:s,length:o}})}}}var he=32n;async function Qt({offset:e=0n,length:t},n){const i=e/he,s=e%he,o=t??he-s;if(o===0n)return D.zero();const r=s+o,a=(r+he-1n)/he,c=[];for(let l=0n;l<a;l++){const f=l===0n?s:0n,h=l===a-1n?r-l*he:he;c.push(await n(i+l,{offset:f,length:h-f}))}return D.zero().concat(...c)}function pi(e,t){return t===0n?e:D.fromUint(e.asUint()+t).padUntilAtLeast(e.length)}function de(e,t){const n={};for(const i of e){const s=t[i];typeof s<"u"&&(n[i]=s.asUint())}return n}var mt=BigInt(2**32-1),ui=BigInt(32);function fr(e,t=!1){return t?{h:Number(e&mt),l:Number(e>>ui&mt)}:{h:Number(e>>ui&mt)|0,l:Number(e&mt)|0}}function hr(e,t=!1){let n=new Uint32Array(e.length),i=new Uint32Array(e.length);for(let s=0;s<e.length;s++){const{h:o,l:r}=fr(e[s],t);[n[s],i[s]]=[o,r]}return[n,i]}var dr=(e,t,n)=>e<<n|t>>>32-n,pr=(e,t,n)=>t<<n|e>>>32-n,ur=(e,t,n)=>t<<n-32|e>>>64-n,mr=(e,t,n)=>e<<n-32|t>>>64-n,mi=[],gi=[],yi=[],gr=BigInt(0),Fe=BigInt(1),yr=BigInt(2),br=BigInt(7),wr=BigInt(256),kr=BigInt(113);for(let e=0,t=Fe,n=1,i=0;e<24;e++){[n,i]=[i,(2*n+3*i)%5],mi.push(2*(5*i+n)),gi.push((e+1)*(e+2)/2%64);let s=gr;for(let o=0;o<7;o++)t=(t<<Fe^(t>>br)*kr)%wr,t&yr&&(s^=Fe<<(Fe<<BigInt(o))-Fe);yi.push(s)}var[$r,xr]=hr(yi,!0),bi=(e,t,n)=>n>32?ur(e,t,n):dr(e,t,n),wi=(e,t,n)=>n>32?mr(e,t,n):pr(e,t,n);function vr(e,t=24){const n=new Uint32Array(10);for(let i=24-t;i<24;i++){for(let r=0;r<10;r++)n[r]=e[r]^e[r+10]^e[r+20]^e[r+30]^e[r+40];for(let r=0;r<10;r+=2){const a=(r+8)%10,c=(r+2)%10,l=n[c],f=n[c+1],h=bi(l,f,1)^n[a],d=wi(l,f,1)^n[a+1];for(let u=0;u<50;u+=10)e[r+u]^=h,e[r+u+1]^=d}let s=e[2],o=e[3];for(let r=0;r<24;r++){const a=gi[r],c=bi(s,o,a),l=wi(s,o,a),f=mi[r];s=e[f],o=e[f+1],e[f]=c,e[f+1]=l}for(let r=0;r<50;r+=10){for(let a=0;a<10;a++)n[a]=e[r+a];for(let a=0;a<10;a++)e[r+a]^=~n[(a+2)%10]&n[(a+4)%10]}e[0]^=$r[i],e[1]^=xr[i]}n.fill(0)}var ki=class Ni extends or{constructor(t,n,i,s=!1,o=24){if(super(),this.blockLen=t,this.suffix=n,this.outputLen=i,this.enableXOF=s,this.rounds=o,this.pos=0,this.posOut=0,this.finished=!1,this.destroyed=!1,Ke(i),0>=this.blockLen||this.blockLen>=200)throw new Error("Sha3 supports only keccak-f1600 function");this.state=new Uint8Array(200),this.state32=tr(this.state)}keccak(){hi||di(this.state32),vr(this.state32,this.rounds),hi||di(this.state32),this.posOut=0,this.pos=0}update(t){Ht(this);const{blockLen:n,state:i}=this;t=Gt(t);const s=t.length;for(let o=0;o<s;){const r=Math.min(n-this.pos,s-o);for(let a=0;a<r;a++)i[this.pos++]^=t[o++];this.pos===n&&this.keccak()}return this}finish(){if(this.finished)return;this.finished=!0;const{state:t,suffix:n,pos:i,blockLen:s}=this;t[i]^=n,(n&128)!==0&&i===s-1&&this.keccak(),t[s-1]^=128,this.keccak()}writeInto(t){Ht(this,!1),Ue(t),this.finish();const n=this.state,{blockLen:i}=this;for(let s=0,o=t.length;s<o;){this.posOut>=i&&this.keccak();const r=Math.min(i-this.posOut,o-s);t.set(n.subarray(this.posOut,this.posOut+r),s),this.posOut+=r,s+=r}return t}xofInto(t){if(!this.enableXOF)throw new Error("XOF is not possible for this instance");return this.writeInto(t)}xof(t){return Ke(t),this.xofInto(new Uint8Array(t))}digestInto(t){if(fi(t,this),this.finished)throw new Error("digest() was already called");return this.writeInto(t),this.destroy(),t}digest(){return this.digestInto(new Uint8Array(this.outputLen))}destroy(){this.destroyed=!0,this.state.fill(0)}_cloneInto(t){const{blockLen:n,suffix:i,outputLen:s,rounds:o,enableXOF:r}=this;return t||(t=new Ni(n,i,s,r,o)),t.state32.set(this.state32),t.pos=this.pos,t.posOut=this.posOut,t.finished=this.finished,t.rounds=o,t.suffix=i,t.outputLen=s,t.enableXOF=r,t.destroyed=this.destroyed,t}},se=(e,t,n)=>ar(()=>new ki(t,e,n)),uo=se(6,144,224/8),mo=se(6,136,256/8),go=se(6,104,384/8),yo=se(6,72,512/8),Ar=se(1,144,224/8),$i=se(1,136,256/8),Sr=se(1,104,384/8),jr=se(1,72,512/8),xi=(e,t,n)=>cr((i={})=>new ki(t,e,i.dkLen===void 0?n:i.dkLen,!0)),bo=xi(31,168,128/8),wo=xi(31,136,256/8),ko=ut(Ar),vi=(()=>{const e=ut($i);return e.create=$i.create,e})(),$o=ut(Sr),xo=ut(jr),E;(e=>{e.integer=t=>({sort:"integer",value:t}),e.bytes=t=>({sort:"bytes",data:t}),e.isInteger=t=>t.sort==="integer",e.isBytes=t=>t.sort==="bytes",e.toInteger=t=>(0,e.isInteger)(t)?t.value:t.data.asUint(),e.toData=t=>(0,e.isBytes)(t)?t.data:D.fromUint(t.value)})(E||(E={}));async function pe(e,t){if(S.Expression.isLiteral(e))return Or(e);if(S.Expression.isConstant(e))return Er(e);if(S.Expression.isVariable(e))return Ir(e,t);if(S.Expression.isArithmetic(e))return Nr(e,t);if(S.Expression.isKeccak256(e))return Lr(e,t);if(S.Expression.isConcat(e))return Cr(e,t);if(S.Expression.isResize(e))return _r(e,t);if(S.Expression.isLookup(e)){if(S.Expression.Lookup.isOffset(e))return Xt(".offset",e,t);if(S.Expression.Lookup.isLength(e))return Xt(".length",e,t);if(S.Expression.Lookup.isSlot(e))return Xt(".slot",e,t)}if(S.Expression.isRead(e))return qr(e,t);throw new Error(`Unexpected runtime failure to recognize kind of expression: ${JSON.stringify(e)}`)}async function Tr(e,t){return E.toInteger(await pe(e,t))}async function Ai(e,t,n){return await Promise.all(t.map(async(i,s)=>{const o=await pe(i,n);if(E.isInteger(o))throw new Error([`Operand ${s} of ${e} (${JSON.stringify(i)}) `,`evaluates to the integer ${o.value}, which has no byte `,"width; give it a width with $wordsized or $sizedN"].join(""));return o.data}))}async function Or(e){switch(typeof e){case"string":return e.slice(2).length%2===1?E.integer(BigInt(e)):E.bytes(D.fromHex(e));case"number":return E.integer(BigInt(e))}}async function Er(e){switch(e){case"$wordsize":return E.integer(32n)}}async function Ir(e,{variables:t}){const n=t[e];if(typeof n>"u")throw new Error(`Unknown variable with identifier ${e}`);return n}async function Nr(e,t){const[[n,i]]=Object.entries(e),s=await Promise.all(i.map(o=>Tr(o,t)));switch(n){case"$sum":return E.integer(s.reduce((o,r)=>o+r,0n));case"$difference":{const[o,r]=s;return E.integer(o>r?o-r:0n)}case"$product":return E.integer(s.reduce((o,r)=>o*r,1n));case"$quotient":{const[o,r]=s;return E.integer(o/r)}case"$remainder":{const[o,r]=s;return E.integer(o%r)}}throw new Error(`Unknown arithmetic operation ${n}`)}async function Lr(e,t){const n=await Ai("$keccak256",e.$keccak256,t),i=D.zero().concat(...n);return E.bytes(D.fromBytes(vi(i)))}async function Cr(e,t){const n=await Ai("$concat",e.$concat,t);return E.bytes(D.zero().concat(...n))}async function _r(e,t){const[[n,i]]=Object.entries(e),s=S.Expression.Resize.isToNumber(e)?Number(n.match(/^\$sized([1-9]+[0-9]*)$/)[1]):32,o=await pe(i,t);return E.bytes(E.toData(o).resizeTo(s))}async function Xt(e,t,n){const{regions:i}=n,s=t[e],o=i[s];if(!o)throw new Error(`Region not found: ${s}`);const r=S.Expression.Lookup.propertyFrom(e),a=o[r];if(typeof a>"u")throw new Error(`Region named ${s} does not have ${r} needed by lookup`);return E.integer(a.asUint())}async function qr(e,t){const{state:n,regions:i}=t,s=e.$read,o=i[s];if(!o)throw new Error(`Region not found: ${s}`);return E.bytes(await Yt(o,t))}async function Pr(e,t){const n={},i={},s=new Proxy({...e},{get(a,c){if(c in n)return n[c];throw new Error(`Property not evaluated yet: $this.${c.toString()}`)}}),o=["slot","offset","length"],r=o.filter(a=>a in e).map(a=>[a,e[a]]);for(;r.length>0;){const[a,c]=r.shift();try{const l=await pe(c,{...t,regions:{...t.regions,$this:s}});n[a]=E.toData(l)}catch(l){if(l instanceof Error&&l.message.startsWith("Property not evaluated yet: $this.")){const f=i[a]||0;if(f>o.length-1)throw new Error(`Circular reference detected: $this.${a.toString()}`);i[a]=f+1,r.push([a,c])}else throw l}}return{...e,...n}}function Rr(e,t){if(S.Region.isStack(e)){const n=t===0n?e.slot:t>0n?{$sum:[e.slot,`0x${t.toString(16)}`]}:{$difference:[e.slot,`0x${-t.toString(16)}`]};return{...e,slot:n}}return e}async function*Br(e,t){if(S.isRegion(e))return yield*zr(e,t);const n=e;if(S.Collection.isGroup(n))return yield*Dr(n,t);if(S.Collection.isList(n))return yield*Mr(n,t);if(S.Collection.isConditional(n))return yield*Kr(n,t);if(S.Collection.isScope(n))return yield*Ur(n,t);if(S.Collection.isReference(n))return yield*Fr(n,t);if(S.Collection.isTemplates(n))return yield*Vr(n,t);throw console.error("%s",JSON.stringify(e,void 0,2)),new Error("Unexpected unknown kind of pointer")}async function*zr(e,{stackLengthChange:t,...n}){const i=await Pr(Rr(e,t),n);return yield i,typeof e.name<"u"?[_.saveRegions({[e.name]:i})]:[]}async function*Dr(e,t){const{group:n}=e;return n.map(_.dereferencePointer)}async function*Mr(e,t){const{list:n}=e,{count:i,each:s,is:o}=n,r=E.toInteger(await pe(i,t)),a=[];for(let c=0n;c<r;c++)a.push(_.saveVariables({[s]:E.integer(c)})),a.push(_.dereferencePointer(o));return a}async function*Kr(e,t){const{if:n,then:i,else:s}=e;return E.toInteger(await pe(n,t))?[_.dereferencePointer(i)]:s?[_.dereferencePointer(s)]:[]}async function*Ur(e,t){const{define:n,in:i}=e,s=Object.assign(Object.create(null),t.variables),o={};for(const[r,a]of Object.entries(n)){const c=await pe(a,{...t,variables:s});s[r]=c,o[r]=c}return[_.saveVariables(o),_.dereferencePointer(i),_.restoreVariables(Object.assign(Object.create(null),t.variables))]}async function*Fr(e,t){const{template:n,yields:i}=e,{templates:s,variables:o}=t,r=s[n];if(!r)throw new Error(`Unknown pointer template named ${n}`);const{expect:a,for:c}=r,l=new Set(Object.keys(o)),f=a.filter(h=>!l.has(h));if(f.length>0)throw new Error([`Invalid reference to template named ${n}; missing expected `,`variables with identifiers: ${f.join(", ")}. `,"Please ensure these variables are defined prior to this reference."].join(""));return i&&Object.keys(i).length>0?[_.pushRegionRenames(i),_.dereferencePointer(c),_.popRegionRenames()]:[_.dereferencePointer(c)]}async function*Vr(e,t){const{templates:n,in:i}=e;return[_.pushTemplates(n),_.dereferencePointer(i),_.popTemplates()]}async function*Jr(e,t){const n=await Wr(t),{regions:i,variables:s}=n,o=[],r=[],a=[_.dereferencePointer(e)];for(;a.length>0;){const c=a.pop();let l=[];switch(c.kind){case"dereference-pointer":{const f=r.reduce((u,g)=>({...u,...g}),n.templates),h=Br(c.pointer,{...n,templates:f});let d=await h.next();for(;!d.done;){let u=d.value;if(u.name){const g=o.reduceRight((p,m)=>Hr(m,p)?m[p]:p,u.name);g!==u.name&&(u={...u,name:g})}yield u,d=await h.next()}l=d.value;break}case"save-regions":{for(const[f,h]of Object.entries(c.regions))i[f]=h;break}case"save-variables":{Object.assign(s,c.variables);break}case"restore-variables":{for(const f of Object.keys(s))delete s[f];Object.assign(s,c.variables);break}case"push-region-renames":{o.push(c.mapping);break}case"pop-region-renames":{const f=o.pop();if(f)for(const[h,d]of Object.entries(f))h in i&&d!==h&&(i[d]={...i[h],name:d});break}case"push-templates":{r.push(c.templates);break}case"pop-templates":{r.pop();break}}for(let f=l.length-1;f>=0;f--)a.push(l[f])}}var Hr=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);async function Wr({templates:e,state:t,initialStackLength:n}){const s=await t.stack.length-n;return{templates:e,state:t,stackLengthChange:s,regions:Object.create(null),variables:Object.create(null)}}function Gr(e){return{async view(t){const n=[];for await(const a of e(t))n.push(a);const i=Object.create(null),s=Object.create(null),o={writable:!1,enumerable:!1,configurable:!1},r=Object.create(Array.prototype,{length:{value:n.length,...o}});for(const[a,c]of n.entries())Object.defineProperty(r,a,{value:c,...o,enumerable:!0}),typeof c.name=="string"&&(c.name in i||(i[c.name]=[]),i[c.name].push(c),s[c.name]=c);Object.defineProperties(r,{named:{value:a=>a in i?i[a]:[],...o},lookup:{value:s,...o}});for(const[a,c]of Object.entries(s))a in r||Object.defineProperty(r,a,{value:c,...o});return{regions:r,async read(a){return await Yt(a,{state:t})}}}}}async function Yr(e,t={}){const n=await Qr(t);return Gr(s=>({async*[Symbol.asyncIterator](){yield*Jr(e,{...n,state:s})}}))}async function Qr({templates:e={},state:t}){const n=t?await t.stack.length:0n;return{templates:e,initialStackLength:n}}var q;(function(e){e.integer=t=>({sort:"integer",value:t}),e.bytes=t=>({sort:"bytes",data:t}),e.isInteger=t=>t.sort==="integer",e.isBytes=t=>t.sort==="bytes",e.toInteger=t=>e.isInteger(t)?t.value:t.data.asUint(),e.toData=t=>e.isBytes(t)?t.data:D.fromUint(t.value)})(q||(q={}));async function gt(e,t){if(S.Expression.isLiteral(e))return Zr(e);if(S.Expression.isConstant(e))return eo(e);if(S.Expression.isVariable(e))return to(e,t);if(S.Expression.isArithmetic(e))return no(e,t);if(S.Expression.isKeccak256(e))return io(e,t);if(S.Expression.isConcat(e))return so(e,t);if(S.Expression.isResize(e))return ro(e,t);if(S.Expression.isLookup(e)){if(S.Expression.Lookup.isOffset(e))return Zt(".offset",e,t);if(S.Expression.Lookup.isLength(e))return Zt(".length",e,t);if(S.Expression.Lookup.isSlot(e))return Zt(".slot",e,t)}if(S.Expression.isRead(e))return oo(e,t);throw new Error(`Unexpected runtime failure to recognize kind of expression: ${JSON.stringify(e)}`)}async function Xr(e,t){return q.toInteger(await gt(e,t))}async function Si(e,t,n){return await Promise.all(t.map(async(i,s)=>{const o=await gt(i,n);if(q.isInteger(o))throw new Error([`Operand ${s} of ${e} (${JSON.stringify(i)}) `,`evaluates to the integer ${o.value}, which has no byte `,"width; give it a width with $wordsized or $sizedN"].join(""));return o.data}))}async function Zr(e){switch(typeof e){case"string":return e.slice(2).length%2===1?q.integer(BigInt(e)):q.bytes(D.fromHex(e));case"number":return q.integer(BigInt(e))}}async function eo(e){switch(e){case"$wordsize":return q.integer(32n)}}async function to(e,{variables:t}){const n=t[e];if(typeof n>"u")throw new Error(`Unknown variable with identifier ${e}`);return n}async function no(e,t){const[[n,i]]=Object.entries(e),s=await Promise.all(i.map(o=>Xr(o,t)));switch(n){case"$sum":return q.integer(s.reduce((o,r)=>o+r,0n));case"$difference":{const[o,r]=s;return q.integer(o>r?o-r:0n)}case"$product":return q.integer(s.reduce((o,r)=>o*r,1n));case"$quotient":{const[o,r]=s;return q.integer(o/r)}case"$remainder":{const[o,r]=s;return q.integer(o%r)}}throw new Error(`Unknown arithmetic operation ${n}`)}async function io(e,t){const n=await Si("$keccak256",e.$keccak256,t),i=D.zero().concat(...n);return q.bytes(D.fromBytes(vi(i)))}async function so(e,t){const n=await Si("$concat",e.$concat,t);return q.bytes(D.zero().concat(...n))}async function ro(e,t){const[[n,i]]=Object.entries(e),s=S.Expression.Resize.isToNumber(e)?Number(n.match(/^\$sized([1-9]+[0-9]*)$/)[1]):32,o=await gt(i,t);return q.bytes(q.toData(o).resizeTo(s))}async function Zt(e,t,n){const{regions:i}=n,s=t[e],o=i[s];if(!o)throw new Error(`Region not found: ${s}`);const r=S.Expression.Lookup.propertyFrom(e),a=o[r];if(typeof a>"u")throw new Error(`Region named ${s} does not have ${r} needed by lookup`);return q.integer(a.asUint())}async function oo(e,t){const{state:n,regions:i}=t,s=e.$read,o=i[s];if(!o)throw new Error(`Region not found: ${s}`);return q.bytes(await Yt(o,t))}var ao="ec7a81386baaa372134bf90662890a114436afd4";export{D as Data,ao as commit,Yr as dereference,gt as evaluate};
