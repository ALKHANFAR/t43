import {readFileSync} from 'node:fs';
import {measureJourney} from '../lib/journey-cost.mjs';
const [logPath,pricePath]=process.argv.slice(2);
if(!logPath||!pricePath)throw new Error('Usage: node scripts/journey-cost.mjs usage.jsonl reviewed-prices.json');
const records=readFileSync(logPath,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line.includes('chat_model_usage ')?line.slice(line.indexOf('chat_model_usage ')+17):line));
const price=JSON.parse(readFileSync(pricePath,'utf8')),journeys=new Map();
for(const row of records){const key=JSON.stringify([row.company_id,row.request_id]);const items=journeys.get(key)||[];items.push(row);journeys.set(key,items);}
console.log(JSON.stringify({evidence:records.length?'supplied_provider_usage':'no_provider_usage_evidence',journeys:[...journeys].map(([key,items])=>({identity:JSON.parse(key),...measureJourney(items,price)}))},null,2));
