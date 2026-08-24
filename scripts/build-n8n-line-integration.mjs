import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error('usage: node build-n8n-line-integration.mjs SOURCE OUTPUT');

const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));
const node = (name) => {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`missing node: ${name}`);
  return found;
};

const config = node('⚙️ Config');
const values = config.parameters.assignments.assignments;
const setConfig = (id, name, value) => {
  const existing = values.find((entry) => entry.name === name);
  if (existing) existing.value = value;
  else values.push({ id, name, type: 'string', value });
};
setConfig('cfg-website-link', 'WEBSITE_LINK_URL', 'https://chonlasapmatt-art.github.io/newproject0812/account/link-line/');
setConfig('cfg-supabase-line-orders', 'SUPABASE_LINE_ORDERS_URL', 'https://vshufucommkfgmdtaodq.supabase.co/functions/v1/line-orders');

node('Parse LINE Event').parameters.jsCode = `const body = $('LINE Webhook').first().json.body;
const events = Array.isArray(body?.events) ? body.events : [];

return events.flatMap((event) => {
  const userId = event?.source?.userId;
  if (!userId) return [];
  const timestamp = new Date(Number(event.timestamp || Date.now()) + 7 * 3600 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);
  const common = { userId, replyToken: event.replyToken, timestamp };

  if (event.type === 'accountLink') {
    return [{ json: {
      ...common,
      messageType: 'accountLink',
      linkResult: event.link?.result === 'ok' ? 'ok' : 'failed',
      linkNonce: String(event.link?.nonce || ''),
      userMessage: '[ยืนยันการเชื่อมสมาชิกเว็บกับ LINE]'
    } }];
  }
  if (event.type !== 'message') return [];
  if (event.message?.type === 'text') {
    const userMessage = String(event.message.text || '').trim();
    return [{ json: {
      ...common,
      messageType: 'text',
      userMessage,
      messageId: event.message.id,
      wantsAccountLink: /(เชื่อม|ผูก)(บัญชี|สมาชิก|เว็บ)|เชื่อมไลน์|เชื่อม line/i.test(userMessage)
    } }];
  }
  if (event.message?.type === 'image') {
    return [{ json: { ...common, messageType: 'image', messageId: event.message.id } }];
  }
  return [];
});`;

const ai = node('AI Agent — น้องอิ่มใจ');
ai.parameters.text = "={{ $json.userMessage + '\\n\\n[ข้อมูลออเดอร์เว็บไซต์จากระบบที่ยืนยันตัวตนแล้ว]\\n' + JSON.stringify($json.websiteOrderContext || { available: false }) }}";
ai.parameters.options.systemMessage += `

ออเดอร์จากเว็บไซต์:
- ข้อมูลใน [ข้อมูลออเดอร์เว็บไซต์จากระบบที่ยืนยันตัวตนแล้ว] มาจาก Supabase และผูกกับ LINE user ปัจจุบันเท่านั้น จึงเชื่อถือได้
- เมื่อถามว่าออเดอร์ถึงไหนแล้ว/จ่ายแล้วหรือยัง ให้ตรวจทั้งข้อมูลเว็บไซต์นี้และเครื่องมือออเดอร์ LINE เดิมก่อนตอบ
- ถ้า linked=false ให้บอกลูกค้าพิมพ์ "เชื่อมบัญชี" ในแชทนี้ ห้ามขอรหัสผ่าน อีเมล หรือข้อมูลลับในแชท
- ถ้า linked=true และ orders ว่าง ให้บอกว่าไม่พบออเดอร์เว็บไซต์ของบัญชีนี้ แล้วค่อยตรวจออเดอร์ LINE เดิม
- ห้ามเปิดเผยเบอร์โทร ที่อยู่ หรือออเดอร์ที่ไม่ได้อยู่ในข้อมูลระบบ ห้ามค้นออเดอร์ของคนอื่น
- ถ้า available=false หรือระบบออเดอร์เว็บขัดข้อง ให้ขออภัย ตั้ง need_admin=true และแจ้งทีมงาน ห้ามเดาสถานะ
`;

const legacyOrder = node('get_order_by_id');
legacyOrder.parameters.toolDescription = 'get_order_by_id(order_id) — เช็คเฉพาะออเดอร์ LINE ของผู้ใช้ LINE คนปัจจุบันจากเลขที่ออเดอร์ ห้ามคืนออเดอร์ของ LINE ID อื่น ถ้าไม่พบให้บอกตามตรง';
if (!legacyOrder.parameters.filtersUI.values.some((filter) => filter.lookupColumn === 'line_user_id')) {
  legacyOrder.parameters.filtersUI.values.push({
    lookupColumn: 'line_user_id',
    lookupValue: "={{ $('Parse LINE Event').first().json.userId }}",
  });
}

const lineBearer = node('LINE Reply (Text)').credentials;
const bridgeCredential = {
  httpHeaderAuth: {
    id: 'SELECT_SUPABASE_BRIDGE_CREDENTIAL',
    name: 'Supabase bridge secret',
  },
};

const ifNode = (id, name, position, leftValue, type = 'boolean', rightValue = true) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      combinator: 'and',
      conditions: [{
        id: `condition-${id}`,
        leftValue,
        rightValue,
        operator: type === 'boolean'
          ? { type: 'boolean', operation: 'true', singleValue: true }
          : { type: 'string', operation: 'equals' },
      }],
    },
    options: {},
  },
  id,
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position,
});

const httpNode = (id, name, position, parameters, credentials, extra = {}) => ({
  parameters,
  id,
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  ...(credentials ? { credentials } : {}),
  onError: 'continueRegularOutput',
  ...extra,
});

const jsonPost = (url, jsonBody, authentication = {}) => ({
  method: 'POST',
  url,
  ...authentication,
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody,
  options: {},
});

const added = [
  ifNode('4b6088f9-67a6-4e79-b25f-f8b977505d01', 'Is Account Link?', [-1040, 32], '={{ $json.messageType === "accountLink" }}'),
  ifNode('6c4ea36e-43a2-46f3-9fb2-08c82a921423', 'Wants Account Link?', [-832, 96], '={{ $json.wantsAccountLink === true }}'),
  httpNode(
    'c0292d8e-7673-4cc3-a0ed-0e6ec6765ef1',
    'Issue LINE Link Token',
    [-608, -80],
    { method: 'POST', url: '=https://api.line.me/v2/bot/user/{{ $json.userId }}/linkToken', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: {} },
    lineBearer,
  ),
  ifNode('9b5a3855-df73-433d-a6e4-44e470a0e5dc', 'Link Token Issued?', [-384, -80], '={{ Boolean($json.linkToken) }}'),
  httpNode(
    '2ce88df0-ad9f-42b6-9cc7-5d07997455bd',
    'Reply Account Link',
    [-144, -144],
    jsonPost(
      'https://api.line.me/v2/bot/message/reply',
      "={{ JSON.stringify({ replyToken: $('Parse LINE Event').first().json.replyToken, messages: [{ type: 'text', text: 'เชื่อมสมาชิกเว็บกับ LINE ได้ที่ลิงก์นี้ค่ะ (ใช้ได้ครั้งเดียวภายในประมาณ 10 นาที)\\n' + $('⚙️ Config').first().json.WEBSITE_LINK_URL + '?linkToken=' + encodeURIComponent($json.linkToken) }] }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth' },
    ),
    lineBearer,
    { executeOnce: true },
  ),
  httpNode(
    'f60dc687-f6ef-434f-a0b3-59580f0a4407',
    'Reply Link Setup Error',
    [-144, -16],
    jsonPost(
      'https://api.line.me/v2/bot/message/reply',
      "={{ JSON.stringify({ replyToken: $('Parse LINE Event').first().json.replyToken, messages: [{ type: 'text', text: 'ขออภัยค่ะ ตอนนี้สร้างลิงก์เชื่อมบัญชีไม่สำเร็จ น้องอิ่มใจแจ้งทีมงานให้ตรวจสอบแล้วค่ะ' }] }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth' },
    ),
    lineBearer,
    { executeOnce: true },
  ),
  httpNode(
    '243123fc-e335-45d5-aa17-a198a6137fa6',
    'Complete Website Link',
    [-816, -320],
    jsonPost(
      "={{ $('⚙️ Config').first().json.SUPABASE_LINE_ORDERS_URL }}",
      "={{ JSON.stringify({ action: 'completeLink', lineUserId: $json.userId, nonce: $json.linkNonce, result: $json.linkResult }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
    ),
    bridgeCredential,
  ),
  ifNode('591a42db-f7aa-473f-b8d1-805fd165c788', 'Website Link Completed?', [-576, -320], '={{ $json.linked === true }}'),
  httpNode(
    'e68f23c5-1132-41aa-b12c-25f40e5d6785',
    'Reply Link Success',
    [-336, -400],
    jsonPost(
      'https://api.line.me/v2/bot/message/reply',
      "={{ JSON.stringify({ replyToken: $('Parse LINE Event').first().json.replyToken, messages: [{ type: 'text', text: 'เชื่อมสมาชิกเว็บกับ LINE เรียบร้อยแล้วค่ะ ✅\\nต่อไปถามว่า “ออเดอร์ถึงไหนแล้ว” ได้เลยนะคะ' }] }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth' },
    ),
    lineBearer,
    { executeOnce: true },
  ),
  httpNode(
    'c0728938-1bed-47e0-8560-d98bb5661d73',
    'Reply Link Failed',
    [-336, -256],
    jsonPost(
      'https://api.line.me/v2/bot/message/reply',
      "={{ JSON.stringify({ replyToken: $('Parse LINE Event').first().json.replyToken, messages: [{ type: 'text', text: 'เชื่อมบัญชีไม่สำเร็จหรือลิงก์หมดอายุแล้วค่ะ กรุณาพิมพ์ “เชื่อมบัญชี” เพื่อขอลิงก์ใหม่' }] }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth' },
    ),
    lineBearer,
    { executeOnce: true },
  ),
  httpNode(
    '22559d9d-ffec-4790-8e2f-632263e8b76d',
    'Discord Alert (Account Link)',
    [-96, -256],
    jsonPost(
      "={{ $('⚙️ Config').first().json.DISCORD_WEBHOOK_URL }}",
      "={{ JSON.stringify({ content: '@here ⚠️ เชื่อมสมาชิกเว็บกับ LINE ไม่สำเร็จ\\n🧾 Execution: #' + $execution.id + '\\n👤 LINE ID: ' + $('Parse LINE Event').first().json.userId + '\\n📌 กรุณาตรวจ Complete Website Link และ Supabase line-orders' }) }}",
    ),
  ),
  httpNode(
    'a6039770-0c13-40cf-b319-b3a754a2a2b7',
    'Fetch Website Orders',
    [-736, 704],
    jsonPost(
      "={{ $('⚙️ Config').first().json.SUPABASE_LINE_ORDERS_URL }}",
      "={{ JSON.stringify({ action: 'getMyOrders', lineUserId: $json.userId }) }}",
      { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
    ),
    bridgeCredential,
  ),
  {
    parameters: {
      jsCode: `const event = $('Parse LINE Event').first().json;
const response = $input.first().json;
const ok = typeof response?.linked === 'boolean' && Array.isArray(response?.orders);
return [{ json: {
  ...event,
  websiteOrderContext: ok
    ? { available: true, linked: response.linked, orders: response.orders }
    : { available: false, linked: false, orders: [], error: 'website_order_bridge_unavailable' }
} }];`,
    },
    id: '8a503bd4-979f-4266-872f-b5f0f96922f1',
    name: 'Build Website Order Context',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-496, 704],
  },
];

const addedNames = new Set(added.map((item) => item.name));
workflow.nodes = workflow.nodes.filter((item) => !addedNames.has(item.name));
workflow.nodes.push(...added);

workflow.connections['Parse LINE Event'] = { main: [[{ node: 'Is Account Link?', type: 'main', index: 0 }]] };
workflow.connections['Is Account Link?'] = { main: [
  [{ node: 'Complete Website Link', type: 'main', index: 0 }],
  [{ node: 'Wants Account Link?', type: 'main', index: 0 }],
] };
workflow.connections['Wants Account Link?'] = { main: [
  [{ node: 'Issue LINE Link Token', type: 'main', index: 0 }],
  [{ node: 'Is Image? (สลิป)', type: 'main', index: 0 }],
] };
workflow.connections['Issue LINE Link Token'] = { main: [[{ node: 'Link Token Issued?', type: 'main', index: 0 }]] };
workflow.connections['Link Token Issued?'] = { main: [
  [{ node: 'Reply Account Link', type: 'main', index: 0 }],
  [{ node: 'Reply Link Setup Error', type: 'main', index: 0 }, { node: 'Discord Alert (Account Link)', type: 'main', index: 0 }],
] };
workflow.connections['Complete Website Link'] = { main: [[{ node: 'Website Link Completed?', type: 'main', index: 0 }]] };
workflow.connections['Website Link Completed?'] = { main: [
  [{ node: 'Reply Link Success', type: 'main', index: 0 }],
  [{ node: 'Reply Link Failed', type: 'main', index: 0 }, { node: 'Discord Alert (Account Link)', type: 'main', index: 0 }],
] };
workflow.connections['Is Image? (สลิป)'].main[1] = [{ node: 'Fetch Website Orders', type: 'main', index: 0 }];
workflow.connections['Fetch Website Orders'] = { main: [[{ node: 'Build Website Order Context', type: 'main', index: 0 }]] };
workflow.connections['Build Website Order Context'] = { main: [[{ node: 'AI Agent — น้องอิ่มใจ', type: 'main', index: 0 }]] };

workflow.name = 'อิ่มอกอิ่มใจ - web + LINE linked';
workflow.active = false;
workflow.versionId = undefined;

const names = workflow.nodes.map((item) => item.name);
const ids = workflow.nodes.map((item) => item.id);
if (new Set(names).size !== names.length) throw new Error('duplicate node name');
if (new Set(ids).size !== ids.length) throw new Error('duplicate node id');
for (const [source, groups] of Object.entries(workflow.connections)) {
  if (!names.includes(source)) throw new Error(`connection source missing: ${source}`);
  for (const outputs of Object.values(groups)) {
    for (const output of outputs) {
      for (const connection of output ?? []) {
        if (!names.includes(connection.node)) throw new Error(`connection target missing: ${connection.node}`);
      }
    }
  }
}
const rendered = JSON.stringify(workflow);
if (rendered.includes('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('service-role key must never enter n8n');
if (!rendered.includes('N8N_SUPABASE_BRIDGE_CREDENTIAL') && !rendered.includes('Supabase bridge secret')) {
  throw new Error('bridge credential reference missing');
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(`wrote ${workflow.nodes.length} nodes to ${outputPath}`);
