import {safeUrl} from './library-model.js';
export function makeFieldReportPacket(items,index,{limit=100}={}){
 const records=[];for(const item of items){if(!safeUrl(item?.url))continue;for(const fit of index?.items?.[item.id]||[]){if(fit.decision==='not-now'||fit.score<2)continue;if(records.length>=limit)break;records.push({id:(item.id+'|'+fit.productId).slice(0,160),productId:fit.productId,url:item.url,title:String(item.title||item.url).slice(0,300),source:String(item.source||'saved-link').slice(0,60),coverage:String(item.contentCoverage||'Saved link; linked page not verified').slice(0,160),summary:String(item.summary||item.potentialUse||'').slice(0,1200),reason:String(fit.reason||'Suggested project fit').slice(0,500),contextObservedAt:index.sourceObservedAt||''});}if(records.length>=limit)break;}
 return {schema:'field-report-library-proposals.v1',generatedAt:new Date().toISOString(),authority:'proposal only',records};
}
