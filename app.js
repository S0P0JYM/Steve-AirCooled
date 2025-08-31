// Offline Mechanic System SPA
const DB_KEY = 'mechDB_v1';
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

// ---------- Storage ----------
function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw){
    try { return JSON.parse(raw); } catch(e){ console.error('DB parse', e); }
  }
  // seed
  const db = {
    users:[{id:1,username:'Steve',password:'Steve7676',role:'owner'}],
    customers:[],
    vehicles:[],
    inventory:[],
    workorders:[],
    meta:{nextIds:{cust:1,veh:1,inv:1,wo:1}}
  };
  saveDB(db);
  return db;
}
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
let DB = loadDB();

// ---------- Auth ----------
let CURRENT_USER = null;
function login(username, password){
  const u = DB.users.find(u=>u.username===username && u.password===password);
  if(u){ CURRENT_USER = {id:u.id, username:u.username, role:u.role}; return true; }
  return false;
}
function logout(){ CURRENT_USER = null; }

// ---------- Utilities ----------
function uid(kind){
  const k = DB.meta.nextIds;
  const map={cust:'cust',veh:'veh',inv:'inv',wo:'wo'};
  const key = map[kind];
  if(!key) throw new Error('bad kind');
  const val = DB.meta.nextIds[key]++;
  saveDB(DB);
  return val;
}
function fmtMoney(n){ return '$' + (Number(n||0).toFixed(2)); }
function download(filename, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}
function toCSV(rows){
  if(!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => ('"'+String(v).replaceAll('"','""')+'"');
  const lines = [headers.join(',')];
  for(const r of rows){
    lines.push(headers.map(h=>esc(r[h]??'')).join(','));
  }
  return lines.join('\n');
}

// ---------- Rendering ----------
function show(view){
  const content = $('#content');
  content.innerHTML = '';
  if(view==='customers') renderCustomers(content);
  if(view==='vehicles') renderVehicles(content);
  if(view==='inventory') renderInventory(content);
  if(view==='workorders') renderWorkorders(content);
  if(view==='settings') renderSettings(content);
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===view));
}

// Customers
function renderCustomers(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="toolbar">
      <input class="search" id="custSearch" placeholder="Search customers..." />
      <div class="inline">
        <button class="btn" id="exportCSV">Export CSV</button>
        <button class="btn success" id="newCust">+ New</button>
      </div>
    </div>
    <table class="table" id="custTable">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th></th></tr></thead>
      <tbody></tbody>
    </table>`;
  root.appendChild(panel);

  function draw(filter=''){
    const tbody = $('#custTable tbody', panel);
    tbody.innerHTML = '';
    const q = filter.toLowerCase();
    DB.customers
      .filter(c => [c.name,c.phone,c.email,(c.address||'')].some(v=>String(v||'').toLowerCase().includes(q)))
      .forEach(c=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.name}</td><td>${c.phone||''}</td><td>${c.email||''}</td><td>${c.address||''}</td>
          <td class="actions">
            <button class="btn small" data-edit="${c.id}">Edit</button>
            <button class="btn warn small" data-del="${c.id}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });
  }
  draw();

  $('#custSearch', panel).addEventListener('input', e=>draw(e.target.value));
  $('#exportCSV', panel).addEventListener('click', ()=>{
    const csv = toCSV(DB.customers);
    download('customers.csv', csv);
  });
  $('#newCust', panel).addEventListener('click', ()=>openCustForm());
  panel.addEventListener('click', e=>{
    const id = e.target.dataset.edit || e.target.dataset.del;
    if(!id) return;
    const cust = DB.customers.find(c=>c.id==id);
    if(e.target.dataset.edit) openCustForm(cust);
    if(e.target.dataset.del){
      if(confirm('Delete customer and related vehicles/work orders?')){
        // cascade delete
        DB.vehicles = DB.vehicles.filter(v=>v.customerId!=cust.id);
        DB.workorders = DB.workorders.filter(w=>w.customerId!=cust.id);
        DB.customers = DB.customers.filter(c=>c.id!=cust.id);
        saveDB(DB); draw($('#custSearch', panel).value);
      }
    }
  });

  function openCustForm(cust){
    const dlg = document.createElement('div');
    dlg.className = 'panel';
    dlg.innerHTML = `
      <h3>${cust?'Edit':'New'} Customer</h3>
      <div class="kv">
        <label>Name</label><input id="fName" value="${cust?cust.name:''}" />
        <label>Phone</label><input id="fPhone" value="${cust?cust.phone||'':''}" />
        <label>Email</label><input id="fEmail" value="${cust?cust.email||'':''}" />
        <label>Address</label><input id="fAddress" value="${cust?cust.address||'':''}" />
      </div>
      <div class="inline" style="margin-top:.75rem">
        <button class="btn success" id="save">Save</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>`;
    root.prepend(dlg);
    $('#cancel', dlg).onclick = ()=>dlg.remove();
    $('#save', dlg).onclick = ()=>{
      const rec = {
        id: cust?cust.id:uid('cust'),
        name: $('#fName', dlg).value.trim(),
        phone: $('#fPhone', dlg).value.trim(),
        email: $('#fEmail', dlg).value.trim(),
        address: $('#fAddress', dlg).value.trim()
      };
      if(!rec.name){ alert('Name required'); return; }
      if(cust){ Object.assign(cust, rec); }
      else DB.customers.push(rec);
      saveDB(DB); dlg.remove(); draw($('#custSearch', panel).value);
    };
  }
}

// Vehicles
function renderVehicles(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="toolbar">
      <input class="search" id="vehSearch" placeholder="Search vehicles (customer, VIN, plate, make, model)..." />
      <div class="inline">
        <button class="btn" id="vehCSV">Export CSV</button>
        <button class="btn success" id="newVeh">+ New</button>
      </div>
    </div>
    <table class="table" id="vehTable">
      <thead><tr><th>Customer</th><th>Year</th><th>Make</th><th>Model</th><th>Plate</th><th>VIN</th><th></th></tr></thead>
      <tbody></tbody>
    </table>`;
  root.appendChild(panel);

  function custName(id){ const c = DB.customers.find(c=>c.id==id); return c?c.name:'—'; }

  function draw(filter=''){
    const q = filter.toLowerCase();
    const tbody = $('#vehTable tbody', panel);
    tbody.innerHTML = '';
    DB.vehicles
      .filter(v => [custName(v.customerId), v.make, v.model, v.plate, v.vin].some(x=>String(x||'').toLowerCase().includes(q)))
      .forEach(v=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${custName(v.customerId)}</td>
          <td>${v.year||''}</td><td>${v.make||''}</td><td>${v.model||''}</td><td>${v.plate||''}</td><td>${v.vin||''}</td>
          <td class="actions">
            <button class="btn small" data-edit="${v.id}">Edit</button>
            <button class="btn warn small" data-del="${v.id}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });
  }
  draw();

  $('#vehSearch', panel).addEventListener('input', e=>draw(e.target.value));
  $('#vehCSV', panel).addEventListener('click', ()=>download('vehicles.csv', toCSV(DB.vehicles)));
  $('#newVeh', panel).addEventListener('click', ()=>openVehForm());
  panel.addEventListener('click', e=>{
    const id = e.target.dataset.edit || e.target.dataset.del;
    if(!id) return;
    const veh = DB.vehicles.find(v=>v.id==id);
    if(e.target.dataset.edit) openVehForm(veh);
    if(e.target.dataset.del){
      if(confirm('Delete vehicle and related work orders?')){
        DB.workorders = DB.workorders.filter(w=>w.vehicleId!=veh.id);
        DB.vehicles = DB.vehicles.filter(v=>v.id!=veh.id);
        saveDB(DB); draw($('#vehSearch', panel).value);
      }
    }
  });

  function openVehForm(veh){
    const dlg = document.createElement('div');
    dlg.className = 'panel';
    const opts = DB.customers.map(c=>`<option value="${c.id}" ${veh&&veh.customerId==c.id?'selected':''}>${c.name}</option>`).join('');
    dlg.innerHTML = `
      <h3>${veh?'Edit':'New'} Vehicle</h3>
      <div class="kv">
        <label>Customer</label>
        <select id="fCust"><option value="">— Choose —</option>${opts}</select>
        <label>Year</label><input id="fYear" value="${veh?veh.year||'':''}" />
        <label>Make</label><input id="fMake" value="${veh?veh.make||'':''}" />
        <label>Model</label><input id="fModel" value="${veh?veh.model||'':''}" />
        <label>Plate</label><input id="fPlate" value="${veh?veh.plate||'':''}" />
        <label>VIN</label><input id="fVin" value="${veh?veh.vin||'':''}" />
        <label>Notes</label><input id="fNotes" value="${veh?veh.notes||'':''}" />
      </div>
      <div class="inline" style="margin-top:.75rem">
        <button class="btn success" id="save">Save</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>`;
    root.prepend(dlg);
    $('#cancel', dlg).onclick = ()=>dlg.remove();
    $('#save', dlg).onclick = ()=>{
      const rec = {
        id: veh?veh.id:uid('veh'),
        customerId: Number($('#fCust', dlg).value),
        year: $('#fYear', dlg).value.trim(),
        make: $('#fMake', dlg).value.trim(),
        model: $('#fModel', dlg).value.trim(),
        plate: $('#fPlate', dlg).value.trim(),
        vin: $('#fVin', dlg).value.trim(),
        notes: $('#fNotes', dlg).value.trim()
      };
      if(!rec.customerId){ alert('Choose a customer'); return; }
      if(veh){ Object.assign(veh, rec); }
      else DB.vehicles.push(rec);
      saveDB(DB); dlg.remove(); draw($('#vehSearch', panel).value);
    };
  }
}

// Inventory
function renderInventory(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="toolbar">
      <input class="search" id="invSearch" placeholder="Search inventory (name, sku)..." />
      <div class="inline">
        <button class="btn" id="invCSV">Export CSV</button>
        <button class="btn success" id="newInv">+ New</button>
      </div>
    </div>
    <table class="table" id="invTable">
      <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Unit Price</th><th></th></tr></thead>
      <tbody></tbody>
    </table>`;
  root.appendChild(panel);

  function draw(filter=''){
    const q = filter.toLowerCase();
    const tbody = $('#invTable tbody', panel);
    tbody.innerHTML = '';
    DB.inventory
      .filter(it => [it.sku, it.name].some(v=>String(v||'').toLowerCase().includes(q)))
      .forEach(it=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${it.sku||''}</td><td>${it.name||''}</td><td>${it.qty??0}</td><td>${fmtMoney(it.price||0)}</td>
          <td class="actions">
            <button class="btn small" data-edit="${it.id}">Edit</button>
            <button class="btn warn small" data-del="${it.id}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });
  }
  draw();

  $('#invSearch', panel).addEventListener('input', e=>draw(e.target.value));
  $('#invCSV', panel).addEventListener('click', ()=>download('inventory.csv', toCSV(DB.inventory)));
  $('#newInv', panel).addEventListener('click', ()=>openInvForm());
  panel.addEventListener('click', e=>{
    const id = e.target.dataset.edit || e.target.dataset.del;
    if(!id) return;
    const it = DB.inventory.find(i=>i.id==id);
    if(e.target.dataset.edit) openInvForm(it);
    if(e.target.dataset.del){
      if(confirm('Delete inventory item?')){
        DB.inventory = DB.inventory.filter(i=>i.id!=it.id);
        saveDB(DB); draw($('#invSearch', panel).value);
      }
    }
  });

  function openInvForm(it){
    const dlg = document.createElement('div');
    dlg.className = 'panel';
    dlg.innerHTML = `
      <h3>${it?'Edit':'New'} Inventory Item</h3>
      <div class="kv">
        <label>SKU</label><input id="fSku" value="${it?it.sku||'':''}" />
        <label>Name</label><input id="fName" value="${it?it.name||'':''}" />
        <label>Qty</label><input id="fQty" type="number" step="1" value="${it?it.qty||0:0}" />
        <label>Unit Price</label><input id="fPrice" type="number" step="0.01" value="${it?it.price||0:0}" />
      </div>
      <div class="inline" style="margin-top:.75rem">
        <button class="btn success" id="save">Save</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>`;
    root.prepend(dlg);
    $('#cancel', dlg).onclick = ()=>dlg.remove();
    $('#save', dlg).onclick = ()=>{
      const rec = {
        id: it?it.id:uid('inv'),
        sku: $('#fSku', dlg).value.trim(),
        name: $('#fName', dlg).value.trim(),
        qty: Number($('#fQty', dlg).value||0),
        price: Number($('#fPrice', dlg).value||0)
      };
      if(!rec.name){ alert('Name required'); return; }
      if(it){ Object.assign(it, rec); }
      else DB.inventory.push(rec);
      saveDB(DB); dlg.remove(); draw($('#invSearch', panel).value);
    };
  }
}

// Work Orders
function renderWorkorders(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="toolbar">
      <input class="search" id="woSearch" placeholder="Search by customer, vehicle, status..." />
      <div class="inline">
        <button class="btn success" id="newWO">+ New</button>
      </div>
    </div>
    <table class="table" id="woTable">
      <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Total</th><th></th></tr></thead>
      <tbody></tbody>
    </table>`;
  root.appendChild(panel);

  function custName(id){ const c = DB.customers.find(c=>c.id==id); return c?c.name:'—'; }
  function vehName(id){ const v = DB.vehicles.find(v=>v.id==id); return v?`${v.year||''} ${v.make||''} ${v.model||''}`.trim():'—'; }

  function wototal(wo){
    const labor = (wo.labor||[]).reduce((a,x)=>a + Number(x.hours||0)*Number(x.rate||0), 0);
    const parts = (wo.parts||[]).reduce((a,x)=>a + Number(x.qty||0)*Number(x.unit||0), 0);
    const sub = labor + parts;
    const tax = sub * Number(wo.taxRate||0);
    return {labor, parts, sub, tax, total: sub + tax};
  }

  function draw(filter=''){
    const q = filter.toLowerCase();
    const tbody = $('#woTable tbody', panel);
    tbody.innerHTML = '';
    DB.workorders
      .filter(w=>[String(w.id), custName(w.customerId), vehName(w.vehicleId), w.status].some(v=>String(v||'').toLowerCase().includes(q)))
      .forEach(w=>{
        const t = wototal(w);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${w.id}</td>
          <td>${w.date||''}</td>
          <td>${custName(w.customerId)}</td>
          <td>${vehName(w.vehicleId)}</td>
          <td><span class="badge ${w.status=='Open'?'open':w.status=='In Progress'?'progress':'done'}">${w.status}</span></td>
          <td>${fmtMoney(t.total)}</td>
          <td class="actions">
            <button class="btn small" data-edit="${w.id}">Edit</button>
            <button class="btn ghost small" data-print="${w.id}">Print</button>
            <button class="btn warn small" data-del="${w.id}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });
  }
  draw();

  $('#woSearch', panel).addEventListener('input', e=>draw(e.target.value));
  $('#newWO', panel).addEventListener('click', ()=>openWOForm());
  panel.addEventListener('click', e=>{
    const id = e.target.dataset.edit || e.target.dataset.del || e.target.dataset.print;
    if(!id) return;
    const wo = DB.workorders.find(w=>w.id==id);
    if(e.target.dataset.edit) openWOForm(wo);
    if(e.target.dataset.del){
      if(confirm('Delete work order?')){
        DB.workorders = DB.workorders.filter(w=>w.id!=wo.id);
        saveDB(DB); draw($('#woSearch', panel).value);
      }
    }
    if(e.target.dataset.print) printInvoice(wo);
  });

  function lineRow(type, line, idx, arr, hook){
    const tr = document.createElement('tr');
    tr.innerHTML = type==='labor' ? `
      <td><input class="l-desc" value="${line.desc||''}"/></td>
      <td><input class="l-hours" type="number" step="0.1" value="${line.hours||0}"/></td>
      <td><input class="l-rate" type="number" step="0.01" value="${line.rate||0}"/></td>
      <td>${fmtMoney((Number(line.hours||0)*Number(line.rate||0))||0)}</td>
      <td><button class="btn warn small l-del">X</button></td>`
    : `
      <td><input class="p-name" value="${line.name||''}" list="invList"/></td>
      <td><input class="p-qty" type="number" step="1" value="${line.qty||1}"/></td>
      <td><input class="p-unit" type="number" step="0.01" value="${line.unit||0}"/></td>
      <td>${fmtMoney((Number(line.qty||0)*Number(line.unit||0))||0)}</td>
      <td><button class="btn warn small p-del">X</button></td>`;
    hook.appendChild(tr);

    tr.querySelector('.l-del, .p-del')?.addEventListener('click', ()=>{ arr.splice(idx,1); renderTotals(); tr.remove(); });
    tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('input', ()=>{
      if(type==='labor'){
        line.desc = tr.querySelector('.l-desc').value;
        line.hours = Number(tr.querySelector('.l-hours').value||0);
        line.rate = Number(tr.querySelector('.l-rate').value||0);
      } else {
        line.name = tr.querySelector('.p-name').value;
        line.qty = Number(tr.querySelector('.p-qty').value||0);
        line.unit = Number(tr.querySelector('.p-unit').value||0);
      }
      renderTotals();
    }));
  }

  function openWOForm(wo){
    const dlg = document.createElement('div');
    dlg.className = 'panel';
    const custOpts = DB.customers.map(c=>`<option value="${c.id}" ${(wo&&wo.customerId==c.id)?'selected':''}>${c.name}</option>`).join('');
    const vehOpts = DB.vehicles.map(v=>`<option value="${v.id}" ${(wo&&wo.vehicleId==v.id)?'selected':''}>${v.year||''} ${v.make||''} ${v.model||''}</option>`).join('');
    const invDatalist = `<datalist id="invList">${DB.inventory.map(i=>`<option value="${i.name}"></option>`).join('')}</datalist>`;
    dlg.innerHTML = `
      <h3>${wo?'Edit':'New'} Work Order</h3>
      <div class="kv">
        <label>Date</label><input id="fDate" type="date" value="${wo?wo.date:(new Date()).toISOString().slice(0,10)}" />
        <label>Status</label>
        <select id="fStatus">
          ${['Open','In Progress','Completed'].map(s=>`<option ${wo&&wo.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <label>Customer</label><select id="fCust"><option value="">— Choose —</option>${custOpts}</select>
        <label>Vehicle</label><select id="fVeh"><option value="">— Choose —</option>${vehOpts}</select>
        <label>Tax Rate</label><input id="fTax" type="number" step="0.001" value="${wo?wo.taxRate||0:0}" />
        <label>Notes</label><input id="fNotes" value="${wo?wo.notes||'':''}" />
      </div>
      <h4>Labor</h4>
      <table class="table" id="laborTbl"><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Line</th><th></th></tr></thead><tbody></tbody></table>
      <button class="btn" id="addLabor">+ Add Labor</button>
      <h4>Parts</h4>
      <table class="table" id="partsTbl"><thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th>Line</th><th></th></tr></thead><tbody></tbody></table>
      ${invDatalist}
      <button class="btn" id="addPart">+ Add Part</button>
      <hr/>
      <div class="inline">
        <div class="badge">Subtotal: <span id="tSub">$0.00</span></div>
        <div class="badge">Tax: <span id="tTax">$0.00</span></div>
        <div class="badge">Total: <span id="tTotal">$0.00</span></div>
      </div>
      <div class="inline" style="margin-top:.75rem">
        <button class="btn success" id="save">Save Work Order</button>
        <button class="btn ghost" id="cancel">Cancel</button>
        ${wo?'<button class="btn" id="printNow">Print</button>':''}
      </div>`;
    root.prepend(dlg);

    const model = wo ? JSON.parse(JSON.stringify(wo)) : {
      id: uid('wo'),
      date: $('#fDate', dlg).value,
      status: 'Open',
      customerId: null, vehicleId: null,
      taxRate: 0, notes:'',
      labor: [], parts: []
    };

    const tbodyL = $('#laborTbl tbody', dlg);
    const tbodyP = $('#partsTbl tbody', dlg);
    function redrawLines(){
      tbodyL.innerHTML=''; tbodyP.innerHTML='';
      model.labor.forEach((ln,i)=>lineRow('labor', ln, i, model.labor, tbodyL));
      model.parts.forEach((ln,i)=>lineRow('part', ln, i, model.parts, tbodyP));
      renderTotals();
    }
    function renderTotals(){
      const t = (arr, map) => arr.reduce((a,x)=>a+map(x),0);
      const sub = t(model.labor, x=>Number(x.hours||0)*Number(x.rate||0)) + t(model.parts, x=>Number(x.qty||0)*Number(x.unit||0));
      const tax = sub * Number($('#fTax', dlg).value||model.taxRate||0);
      $('#tSub', dlg).textContent = fmtMoney(sub);
      $('#tTax', dlg).textContent = fmtMoney(tax);
      $('#tTotal', dlg).textContent = fmtMoney(sub+tax);
    }
    redrawLines();

    $('#addLabor', dlg).onclick = ()=>{ model.labor.push({desc:'',hours:1,rate:0}); redrawLines(); };
    $('#addPart', dlg).onclick = ()=>{ model.parts.push({name:'',qty:1,unit:0}); redrawLines(); };
    $('#cancel', dlg).onclick = ()=>dlg.remove();
    $('#fDate', dlg).oninput = e=>model.date=e.target.value;
    $('#fStatus', dlg).oninput = e=>model.status=e.target.value;
    $('#fCust', dlg).oninput = e=>model.customerId=Number(e.target.value);
    $('#fVeh', dlg).oninput = e=>model.vehicleId=Number(e.target.value);
    $('#fTax', dlg).oninput = e=>{ model.taxRate=Number(e.target.value||0); renderTotals(); };
    $('#fNotes', dlg).oninput = e=>model.notes=e.target.value;

    $('#save', dlg).onclick = ()=>{
      if(!model.customerId || !model.vehicleId){ alert('Choose customer and vehicle'); return; }
      if(wo){ Object.assign(wo, model); }
      else DB.workorders.push(model);
      saveDB(DB); dlg.remove(); draw($('#woSearch', panel).value);
    };
    $('#printNow', dlg)?.addEventListener('click', ()=>printInvoice(model));
  }

  function printInvoice(wo){
    const customer = DB.customers.find(c=>c.id==wo.customerId);
    const vehicle = DB.vehicles.find(v=>v.id==wo.vehicleId);
    const t = (arr, map) => arr.reduce((a,x)=>a+map(x),0);
    const sub = t(wo.labor, x=>Number(x.hours||0)*Number(x.rate||0)) + t(wo.parts, x=>Number(x.qty||0)*Number(x.unit||0));
    const tax = sub * Number(wo.taxRate||0);
    const total = sub + tax;
    const linesL = wo.labor.map(x=>`<tr><td>${x.desc||''}</td><td>${x.hours||0}</td><td>${fmtMoney(x.rate||0)}</td><td>${fmtMoney((x.hours||0)*(x.rate||0))}</td></tr>`).join('');
    const linesP = wo.parts.map(x=>`<tr><td>${x.name||''}</td><td>${x.qty||0}</td><td>${fmtMoney(x.unit||0)}</td><td>${fmtMoney((x.qty||0)*(x.unit||0))}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice #${wo.id}</title>
      <style>body{font-family:Arial,sans-serif;padding:16px} h1,h2{margin:4px 0} table{width:100%;border-collapse:collapse;margin:8px 0} th,td{border:1px solid #ccc;padding:6px;text-align:left} .rt{text-align:right}</style>
      </head><body>
      <h1>Invoice #${wo.id}</h1>
      <p>Date: ${wo.date||''}</p>
      <h2>Customer</h2>
      <p>${customer?customer.name:''}<br>${customer?customer.phone:''}<br>${customer?customer.email||'':''}</p>
      <h2>Vehicle</h2>
      <p>${vehicle?(vehicle.year||'')+' '+(vehicle.make||'')+' '+(vehicle.model||''):''}<br>VIN: ${vehicle?vehicle.vin||'':''} Plate: ${vehicle?vehicle.plate||'':''}</p>
      <h2>Labor</h2>
      <table><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Line</th></tr></thead><tbody>${linesL||'<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <h2>Parts</h2>
      <table><thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead><tbody>${linesP||'<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <h2 class="rt">Subtotal ${fmtMoney(sub)} | Tax ${fmtMoney(tax)} | Total ${fmtMoney(total)}</h2>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;
    const w = window.open();
    w.document.write(html);
    w.document.close();
  }
}

// Settings (Users + Backup/Restore)
function renderSettings(root){
  const row = document.createElement('div');
  row.className = 'row';

  // Users panel
  const usersP = document.createElement('div');
  usersP.className = 'panel';
  usersP.innerHTML = `
    <h3>Users</h3>
    <div class="toolbar">
      <button class="btn success" id="newUser">+ New User</button>
    </div>
    <table class="table" id="userTable">
      <thead><tr><th>Username</th><th>Role</th><th></th></tr></thead>
      <tbody></tbody>
    </table>`;
  row.appendChild(usersP);
  function drawUsers(){
    const tb = $('#userTable tbody', usersP);
    tb.innerHTML = '';
    DB.users.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.username}</td><td>${u.role||''}</td>
        <td class="actions">
          <button class="btn small" data-edit="${u.id}">Edit</button>
          ${u.username!=='admin' ? '<button class="btn warn small" data-del="'+u.id+'">Delete</button>' : ''}
        </td>`;
      tb.appendChild(tr);
    });
  }
  drawUsers();
  usersP.addEventListener('click', e=>{
    const id = e.target.dataset.edit || e.target.dataset.del;
    if(!id) return;
    const u = DB.users.find(x=>x.id==id);
    if(e.target.dataset.edit) openUserForm(u);
    if(e.target.dataset.del){
      if(confirm('Delete user?')){
        DB.users = DB.users.filter(x=>x.id!=u.id);
        saveDB(DB); drawUsers();
      }
    }
  });
  $('#newUser', usersP).onclick = ()=>openUserForm();

  function openUserForm(u){
    const dlg = document.createElement('div');
    dlg.className = 'panel';
    dlg.innerHTML = `
      <h3>${u?'Edit':'New'} User</h3>
      <div class="kv">
        <label>Username</label><input id="fUser" value="${u?u.username:''}" ${u&&u.username==='admin'?'disabled':''} />
        <label>Password</label><input id="fPass" type="text" value="${u?u.password||'':''}" />
        <label>Role</label>
        <select id="fRole">
          ${['owner','manager','tech','clerk'].map(r=>`<option ${u&&u.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="inline" style="margin-top:.75rem">
        <button class="btn success" id="save">Save</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>`;
    root.prepend(dlg);
    $('#cancel', dlg).onclick = ()=>dlg.remove();
    $('#save', dlg).onclick = ()=>{
      const rec = {
        id: u?u.id:Math.max(0,...DB.users.map(x=>x.id))+1,
        username: $('#fUser', dlg).value.trim(),
        password: $('#fPass', dlg).value.trim(),
        role: $('#fRole', dlg).value
      };
      if(!rec.username || !rec.password){ alert('Username and password required'); return; }
      if(u){ Object.assign(u, rec); } else DB.users.push(rec);
      saveDB(DB); dlg.remove(); drawUsers();
    };
  }

  // Backup/Restore panel
  const br = document.createElement('div');
  br.className = 'panel';
  br.innerHTML = `
    <h3>Backup & Restore</h3>
    <p class="muted small">Export/import all app data as a JSON file.</p>
    <div class="inline">
      <button class="btn" id="backup">Export Backup</button>
      <input type="file" id="restoreFile" accept="application/json" />
      <button class="btn" id="restore">Import Backup</button>
      <button class="btn warn" id="wipe">Wipe Data</button>
    </div>`;
  row.appendChild(br);

  $('#backup', br).onclick = ()=>download('mechanic_backup.json', JSON.stringify(DB, null, 2));
  $('#restore', br).onclick = ()=>{
    const f = $('#restoreFile', br).files[0];
    if(!f) return alert('Choose a file');
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        DB = JSON.parse(reader.result);
        saveDB(DB);
        alert('Restore complete');
      }catch(e){ alert('Invalid backup'); }
    };
    reader.readAsText(f);
  };
  $('#wipe', br).onclick = ()=>{
    if(confirm('This will erase all data. Are you sure?')){
      localStorage.removeItem(DB_KEY);
      DB = loadDB();
      alert('Data wiped');
    }
  };

  root.appendChild(row);
}

// ---------- App bootstrap ----------
function boot(){
  // Login wiring
  $('#btnLogin').addEventListener('click', ()=>{
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    if(login(u,p)){
      $('#loginView').classList.add('hidden');
      $('#mainView').classList.remove('hidden');
      show('customers');
    } else {
      $('#loginMsg').textContent = 'Invalid username or password';
    }
  });
  $('#btnLogout').addEventListener('click', ()=>{
    logout();
    $('#mainView').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
  });

  // Tab routing
  $$('.tab').forEach(t=>t.addEventListener('click', ()=>show(t.dataset.tab)));

  // If already logged in (optional: auto-login admin for convenience)
}
document.addEventListener('DOMContentLoaded', boot);
