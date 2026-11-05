/** Shared by individual and batch printing. Every sheet is 6 × 4 inches. */
export const PRINT_CLIENT_JS=String.raw`
window.printTambolaTickets=async function(gameId,key,playerId){
 const popup=window.open('','_blank');if(!popup)throw Error('Allow popups to print tickets.');
 try{
  const root='/games/'+encodeURIComponent(gameId);
  async function get(path){const r=await fetch(root+path,{headers:{'x-admin-key':key},cache:'no-store'});if(!r.ok)throw Error('Unable to load tickets ('+r.status+').');return r.json();}
  const players=playerId?[{id:playerId}]:(await get('/admin/players')).filter(p=>p.ticketStatus==='SUBMITTED');
  if(!players.length)throw Error('No submitted tickets to print.');
  const tickets=await Promise.all(players.map(p=>get('/admin/players/'+encodeURIComponent(p.id)+'/ticket')));
  if(tickets.some(t=>t.status!=='SUBMITTED'))throw Error('Submit the ticket before printing its final copy.');
  const doc=popup.document;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Diwali tickets · 4 × 6</title><style>@page{size:6in 4in;margin:.2in}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#251527;background:#eee}section{width:5.6in;height:3.6in;padding:.12in;break-after:page;page-break-after:always;background:#fffdf7;overflow:hidden}section:last-child{break-after:auto;page-break-after:auto}header{display:flex;justify-content:space-between;gap:.1in;border-bottom:2px solid #9b6724;padding-bottom:.08in;font-size:10pt}h1{font-size:17pt;margin:.12in 0 .05in;overflow-wrap:anywhere;line-height:1.15;max-height:.55in;overflow:hidden}p{font-size:9pt;margin:.04in 0;overflow-wrap:anywhere}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:.13in 0}td{border:1.4px solid #62404b;height:.46in;text-align:center;font-size:19pt;font-weight:bold}td.blank{background:#ece3d6}footer{font-size:9pt;display:flex;justify-content:space-between}nav{padding:16px}button{padding:10px 16px;font:inherit}@media print{body{background:white}nav{display:none}}@media screen{section{margin:18px auto;box-shadow:0 2px 12px #aaa}}</style></head><body><nav><button id="print">Print 4 × 6 tickets</button> Select 4 × 6 paper, landscape, 100% scale and disable browser headers and footers.</nav></body></html>');doc.close();
  function el(tag,text){const n=doc.createElement(tag);n.textContent=text;return n;}
  for(const ticket of tickets){
   const section=el('section',''),header=el('header','');header.append(el('strong','DIWALI TAMBOLA'),el('span','GAME '+ticket.joinCode));const name=el('h1',ticket.playerName);if(ticket.playerName.length>55)name.style.fontSize='10pt';else if(ticket.playerName.length>35)name.style.fontSize='13pt';section.append(header,name,el('p',ticket.gameName));
   const table=el('table','');for(const row of ticket.grid){const tr=el('tr','');for(const n of row){const td=el('td',n===null?'':String(n));if(n===null)td.className='blank';tr.append(td);}table.append(tr);}section.append(table);
   const footer=el('footer','');footer.append(el('strong','T-'+String(ticket.ticketNumber).padStart(4,'0')),el('span','15 numbers · One lucky evening'));section.append(footer);doc.body.append(section);
  }
  doc.getElementById('print').onclick=()=>popup.print();popup.focus();
 }catch(e){popup.close();throw e;}
};
`;
