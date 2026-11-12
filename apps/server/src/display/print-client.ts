export const PRINT_CLIENT_JS=String.raw`
window.printTambolaTickets=async function(gameId,key,selection){
 if(Array.isArray(selection)&&!selection.length)throw Error('Select at least one ticket to print.');
 const popup=window.open('','_blank');if(!popup)throw Error('Allow popups to print tickets.');
 try{
  const root='/games/'+encodeURIComponent(gameId);
  async function get(path){const r=await fetch(root+path,{headers:{'x-admin-key':key},cache:'no-store'});if(!r.ok)throw Error('Unable to load tickets ('+r.status+').');return r.json();}
  const players=Array.isArray(selection)?selection.map(id=>({id})):selection?[{id:selection}]:(await get('/admin/players')).filter(p=>p.ticketStatus==='SUBMITTED');
  if(!players.length)throw Error('No submitted tickets to print.');
  const tickets=await Promise.all(players.map(p=>get('/admin/players/'+encodeURIComponent(p.id)+'/ticket')));
  if(tickets.some(t=>t.status!=='SUBMITTED'))throw Error('Submit the ticket before printing its final copy.');
  const doc=popup.document;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Tambola tickets · A4</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#251527;background:#eee}.sheet{width:194mm;height:280mm;display:flex;flex-direction:column;gap:3mm;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}section{flex:0 0 90mm;height:90mm;padding:3mm;border:1px solid var(--print-accent,#305b60);background:white;overflow:hidden;break-inside:avoid}header{display:flex;justify-content:space-between;gap:3mm;border-bottom:2px solid var(--print-accent,#305b60);padding-bottom:2mm;font-size:10pt}h1{font-size:16pt;margin:2mm 0 1mm;overflow-wrap:anywhere;line-height:1.1;max-height:12mm;overflow:hidden}p{font-size:9pt;margin:1mm 0;overflow-wrap:anywhere;max-height:8mm;overflow:hidden}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:3mm 0}td{border:1.4px solid #62404b;height:13mm;text-align:center;font-size:19pt;font-weight:bold}td.blank{background:#f1f1f1}footer{font-size:9pt;display:flex;justify-content:space-between}nav{padding:16px}button{padding:10px 16px;font:inherit}@media print{body{background:white}nav{display:none}}@media screen{.sheet{margin:18px auto;box-shadow:0 2px 12px #aaa;background:white}}</style></head><body><nav><button id="print">Print A4 tickets</button> Select A4 paper, portrait, 100% scale and disable browser headers and footers. Up to three tickets print per page.</nav></body></html>');doc.close();
  function el(tag,text){const n=doc.createElement(tag);n.textContent=text;return n;}
  let sheet;
  for(const [index,ticket] of tickets.entries()){
   if(index%3===0){sheet=el('div','');sheet.className='sheet';doc.body.append(sheet);}
   const section=el('section',''),header=el('header','');header.append(el('strong',(window.tambolaThemes?.find(t=>t.id===ticket.appearance?.themeId)||window.tambolaThemes?.[0])?.name||'Tambola'),el('span','GAME '+ticket.joinCode));const name=el('h1',ticket.playerName);if(ticket.playerName.length>55)name.style.fontSize='10pt';else if(ticket.playerName.length>35)name.style.fontSize='13pt';section.style.setProperty('--print-accent',(window.tambolaThemes?.find(t=>t.id===ticket.appearance?.themeId)||window.tambolaThemes?.[0])?.ink||'#305b60');section.append(header,name,el('p',ticket.gameName));
   const table=el('table','');for(const row of ticket.grid){const tr=el('tr','');for(const n of row){const td=el('td',n===null?'':String(n));if(n===null)td.className='blank';tr.append(td);}table.append(tr);}section.append(table);
   const footer=el('footer','');footer.append(el('strong','T-'+String(ticket.ticketNumber).padStart(4,'0')),el('span','15 numbers · One lucky evening'));section.append(footer);sheet.append(section);
  }
  doc.getElementById('print').onclick=()=>popup.print();popup.focus();
 }catch(e){popup.close();throw e;}
};
`;
