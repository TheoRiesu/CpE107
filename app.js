const $ = (id) => document.getElementById(id);
const gray = (bits) => Array.from({ length: 1 << bits }, (_, n) => n ^ (n >> 1));
const state = { vars: ['A','B','C','D'], ones: new Set(), dcs: new Set(), selected: new Set(), groups: [], activeGroup: null, optimal: null, layout: null, form: 'SOP' };
const colors = ['#557b68','#c27b4e','#7185a5','#9a789f','#89934f','#bb6b68','#5d9691','#b28d52'];

function parseList(text, max) {
  if (!text.trim()) return [];
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (parts.some(x => !/^\d+$/.test(x))) throw new Error('Enter minterm numbers separated by commas.');
  const nums = parts.map(Number);
  if (nums.some(n => n < 0 || n >= max)) throw new Error(`Minterms must be between 0 and ${max - 1}.`);
  if (new Set(nums).size !== nums.length) throw new Error('Each minterm should appear only once.');
  return nums;
}
function bitsOf(n) { return n.toString(2).padStart(state.vars.length, '0'); }
function patternFor(nums) {
  const patterns = nums.map(bitsOf);
  return state.vars.map((_, i) => patterns.every(p => p[i] === patterns[0][i]) ? patterns[0][i] : '-').join('');
}
function mintermsFor(pattern) {
  const result = [];
  for (let n=0; n < 2 ** state.vars.length; n++) {
    const b = bitsOf(n);
    if ([...pattern].every((v,i) => v === '-' || v === b[i])) result.push(n);
  }
  return result;
}
function termFor(pattern) {
  if(state.form==='POS'){
    const literals=[...pattern].map((bit,i)=>bit==='-'?'':(bit==='0'?state.vars[i]:`${state.vars[i]}'`)).filter(Boolean);
    return literals.length?`(${literals.join(' + ')})`:'0';
  }
  const literals = [...pattern].map((bit,i) => bit === '-' ? '' : (bit === '1' ? state.vars[i] : `${state.vars[i]}'`)).filter(Boolean);
  return literals.length ? literals.join('') : '1';
}
function defaultLayout(vars){return {rows:vars.slice(0,2),cols:vars.slice(2,4),split:vars[4],upperValue:'0'};}
function renderLayoutControls(vars,preserve=true){
  $('layoutControls').hidden=vars.length!==5;
  if(vars.length!==5)return;
  const layout=state.layout;
  if(!preserve||!layout||[...layout.rows,...layout.cols,layout.split].some(v=>!vars.includes(v))||new Set([...layout.rows,...layout.cols,layout.split]).size!==5)state.layout=defaultLayout(vars);
  const fillSelect=(select,value)=>{select.replaceChildren(...vars.map(v=>{const option=document.createElement('option');option.value=v;option.textContent=v;return option;}));select.value=value;};
  const createPair=(mountId,key)=>{const mount=$(mountId);mount.replaceChildren();state.layout[key].forEach((value,index)=>{const select=document.createElement('select');select.setAttribute('aria-label',`${key==='rows'?'Row':'Column'} variable ${index+1}`);fillSelect(select,value);select.addEventListener('change',applyLayoutControls);mount.append(select);});};
  createPair('rowVariableSelects','rows');createPair('columnVariableSelects','cols');fillSelect($('splitVariableSelect'),state.layout.split);$('upperValueSelect').value=state.layout.upperValue;
}
function applyLayoutControls(){
  const rows=[...$('rowVariableSelects').querySelectorAll('select')].map(x=>x.value),cols=[...$('columnVariableSelects').querySelectorAll('select')].map(x=>x.value),split=$('splitVariableSelect').value,all=[...rows,...cols,split];
  if(new Set(all).size!==5){$('layoutMessage').textContent='Some choices currently repeat. Finish assigning each variable once; the map will update when all five are unique.';$('layoutMessage').classList.add('error');return;}
  state.layout={rows,cols,split,upperValue:$('upperValueSelect').value};$('layoutMessage').textContent='Rows and columns use Gray-code order.';$('layoutMessage').classList.remove('error');renderMap();
}
function expressionFor(groups) { return groups.length ? groups.map(g => g.term).join(state.form==='POS'?' · ':' + ') : (state.form==='POS'?'1':'0'); }
function targetSet(){return state.form==='SOP'?state.ones:new Set(Array.from({length:2**state.vars.length},(_,m)=>m).filter(m=>!state.ones.has(m)&&!state.dcs.has(m)));}
function coords(n) {
  const b = bitsOf(n), rBits = Math.floor(b.length/2), cBits = b.length-rBits;
  const r = parseInt(b.slice(0,rBits),2), c = parseInt(b.slice(rBits),2);
  return [gray(rBits).indexOf(r), gray(cBits).indexOf(c)];
}
function renderMap() {
  const n=state.vars.length, splitFive=n===5, rb=splitFive?2:Math.floor(n/2), cb=splitFive?2:n-rb, rowCodes=gray(rb), colCodes=gray(cb);
  const table=document.createElement('table'); table.className=`kmap${splitFive?' kmap-five':''}`;
  const head=document.createElement('thead'), tr=document.createElement('tr');
  const corner=document.createElement('th'); corner.className='corner'; corner.textContent=splitFive?`${state.layout.rows.join('')} \\ ${state.layout.cols.join('')} · ${state.layout.split} in halves`:`${state.vars.slice(0,rb).join('')} \\ ${state.vars.slice(rb).join('')}`; tr.append(corner);
  colCodes.forEach(code=>{const th=document.createElement('th');th.textContent=code.toString(2).padStart(cb,'0');tr.append(th);});head.append(tr);table.append(head);
  const makeCell=(m,half)=>{const button=document.createElement('button');button.type='button';button.className='cell';
    const groupIndexes=state.groups.map((g,i)=>g.cells.includes(m)?i:-1).filter(i=>i>=0);const groupIndex=state.activeGroup!==null&&groupIndexes.includes(state.activeGroup)?state.activeGroup:groupIndexes[0];const value=state.ones.has(m)?'1':state.dcs.has(m)?'X':'0';
    button.classList.add(value==='1'?'value-1':value==='X'?'value-x':'value-0');if(state.selected.has(m))button.classList.add('selected');
    if(groupIndexes.length){button.classList.add('grouped');button.style.setProperty('--group-color',colors[groupIndex%colors.length]);}
    if(state.activeGroup!==null){button.classList.add(groupIndexes.includes(state.activeGroup)?'group-highlight':'group-dim');if(groupIndexes.includes(state.activeGroup))button.style.setProperty('--group-color',colors[state.activeGroup%colors.length]);}
    if(splitFive)button.classList.add(`half-${half}`);
    button.setAttribute('aria-label',`Minterm ${m}${splitFive?`, ${state.layout.split}=${half==='upper'?state.layout.upperValue:1-Number(state.layout.upperValue)}`:''}: ${value==='X'?'don’t-care':value}`);
    const val=document.createElement('span');val.className='cell-value';val.textContent=value;const idx=document.createElement('span');idx.className='cell-index';idx.textContent=m;button.append(val,idx);
    if(groupIndexes.length>1){const markers=document.createElement('span');markers.className='group-markers';markers.setAttribute('aria-hidden','true');groupIndexes.forEach(i=>{const dot=document.createElement('i');dot.style.background=colors[i%colors.length];markers.append(dot);});button.append(markers);}
    button.addEventListener('click',()=>{state.activeGroup=null;if(state.selected.has(m))state.selected.delete(m);else state.selected.add(m);renderMap();renderGroups();updateSelection();});return button;};
  const body=document.createElement('tbody');
  rowCodes.forEach(rowCode=>{const row=document.createElement('tr');const label=document.createElement('th');label.className='axis-label';label.textContent=rowCode.toString(2).padStart(rb,'0');row.append(label);
    colCodes.forEach(colCode=>{const td=document.createElement('td');
      if(splitFive){const wrap=document.createElement('div');wrap.className='split-cell';const rowBits=rowCode.toString(2).padStart(2,'0'),colBits=colCode.toString(2).padStart(2,'0');
        const assign=(splitValue)=>{const values={};state.layout.rows.forEach((v,i)=>values[v]=rowBits[i]);state.layout.cols.forEach((v,i)=>values[v]=colBits[i]);values[state.layout.split]=String(splitValue);return parseInt(state.vars.map(v=>values[v]).join(''),2);};
        const upper=assign(Number(state.layout.upperValue)),lower=assign(1-Number(state.layout.upperValue));wrap.append(makeCell(upper,'upper'),makeCell(lower,'lower'));td.append(wrap);
      }else{const m=parseInt(`${rowCode.toString(2).padStart(rb,'0')}${colCode.toString(2).padStart(cb,'0')}`,2);td.append(makeCell(m,'single'));}
      row.append(td);});body.append(row);});table.append(body);
  $('mapMount').replaceChildren(table);
  $('mapCaption').textContent=splitFive?'4 × 4 · split by fifth variable':`${n} variables · ${2**n} cells`;
}
function updateSelection(){const cells=[...state.selected].sort((a,b)=>a-b);$('selectionReadout').textContent=cells.length?cells.join(', '):'None yet';$('addGroupButton').disabled=!cells.length;}
function renderGroups(){const mount=$('groupList');$('groupCount').textContent=`${state.groups.length} ${state.groups.length===1?'group':'groups'}`;
  if(!state.groups.length){mount.innerHTML='<div class="empty-state">Select a power-of-two group of adjacent cells on the map, then add it here.</div>';}
  else {mount.replaceChildren(...state.groups.map((g,i)=>{const row=document.createElement('div');row.className=`group-item${state.activeGroup===i?' active':''}`;row.style.setProperty('--group-color',colors[i%colors.length]);const left=document.createElement('div');left.className='group-left';const sw=document.createElement('i');sw.className='group-swatch';sw.style.background=colors[i%colors.length];const text=document.createElement('div');const term=document.createElement('button');term.className='group-term group-toggle';term.type='button';term.textContent=g.term;term.setAttribute('aria-pressed',String(state.activeGroup===i));term.addEventListener('click',()=>{state.activeGroup=state.activeGroup===i?null:i;renderGroups();renderMap();updateExpression();});const cells=document.createElement('div');cells.className='group-cells';cells.textContent=`m(${g.cells.join(', ')})`;text.append(term,cells);left.append(sw,text);const del=document.createElement('button');del.className='remove-group';del.type='button';del.setAttribute('aria-label',`Remove group ${g.term}`);del.textContent='×';del.addEventListener('click',()=>{state.groups.splice(i,1);state.activeGroup=null;renderGroups();renderMap();updateExpression();});row.append(left,del);return row;}));}
  updateExpression();
}
function updateExpression(){const expression=$('userExpression');expression.replaceChildren();state.groups.forEach((g,i)=>{if(i){const join=document.createElement('span');join.className='expression-join';join.textContent=state.form==='POS'?' · ':' + ';expression.append(join);}const term=document.createElement('span');term.className='expression-term';term.style.setProperty('--group-color',colors[i%colors.length]);term.textContent=g.term;term.setAttribute('aria-label',`${g.term}, group ${i+1}`);term.addEventListener('click',()=>{state.activeGroup=state.activeGroup===i?null:i;renderGroups();renderMap();updateExpression();});expression.append(term);});if(!state.groups.length)expression.textContent=state.form==='POS'?'1':'0';$('expressionLabel').textContent=state.form==='SOP'?'YOUR SUM OF PRODUCTS':'YOUR PRODUCT OF SUMS';$('mapInstruction').textContent=state.form==='SOP'?'Group adjacent 1s':'Group adjacent 0s';$('mapHelp').textContent=`Click ${state.form==='SOP'?'1':'0'} cells to select a group. Click a colored term to highlight its cells.`;}
function changeForm(){state.form=$('formTypeSelect').value;state.groups=[];state.activeGroup=null;state.selected.clear();state.optimal=minimize([...targetSet()], [...state.dcs]);$('answerPanel').hidden=true;$('feedback').textContent='';$('feedback').className='feedback';renderGroups();renderMap();updateSelection();}
function addGroup(){const cells=[...state.selected].sort((a,b)=>a-b);if(!cells.length)return;
  const pattern=patternFor(cells), cube=mintermsFor(pattern).sort((a,b)=>a-b);
  const target=targetSet();if(cube.some(m=>!target.has(m)&&!state.dcs.has(m))){
    const added=cube.filter(m=>!state.selected.has(m));
    $('feedback').className='feedback bad';
    $('feedback').textContent=added.length?`That group also needs ${added.join(', ')}. Select the full power-of-two group; the added cells must be ${state.form==='SOP'?'1s':'0s'} or don’t-cares.`:`A ${state.form==='SOP'?'1':'0'} group can include don’t-cares, but cannot include the opposite value.`;return;
  }
  if(state.groups.some(g=>g.pattern===pattern)){ $('feedback').className='feedback bad';$('feedback').textContent='That group is already in your expression.';return; }
  state.groups.push({pattern,cells:cube,term:termFor(pattern)});state.selected.clear();
  $('feedback').className=cube.length>cells.length?'feedback good':'feedback';
  $('feedback').textContent=cube.length>cells.length?`Added the full ${cube.length}-cell group, including the wraparound cells.`:'';
  renderGroups();renderMap();updateSelection();
}
function minimize(ones,dcs){
  if(!ones.length)return [];
  let current=new Map();for(const m of [...ones,...dcs])current.set(bitsOf(m),new Set([m]));const primes=new Map();
  while(current.size){const items=[...current.entries()],used=new Set(),next=new Map();
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const [a,ca]=items[i],[b,cb]=items[j];let diff=-1,ok=true;for(let k=0;k<a.length;k++)if(a[k]!==b[k]){if(diff>=0||a[k]==='-'||b[k]==='-'){ok=false;break;}diff=k;}if(!ok||diff<0)continue;const p=a.slice(0,diff)+'-'+a.slice(diff+1);used.add(a);used.add(b);const cov=new Set([...ca,...cb]);if(!next.has(p))next.set(p,cov);else cov.forEach(x=>next.get(p).add(x));}
    for(const [p,c] of items)if(!used.has(p))primes.set(p,c);
    current=next;
  }
  const candidates=[...primes.keys()].filter(p=>mintermsFor(p).some(m=>ones.includes(m))).map(pattern=>({pattern,cells:mintermsFor(pattern),covers:mintermsFor(pattern).filter(m=>ones.includes(m)),term:termFor(pattern),literals:[...pattern].filter(x=>x!=='-').length}));
  const byM=new Map(ones.map(m=>[m,candidates.filter(c=>c.covers.includes(m))]));let best=null;
  function search(covered,chosen){if(covered.size===ones.length){const score=[chosen.length,chosen.reduce((s,c)=>s+c.literals,0)];if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1]))best={score,chosen:[...chosen]};return;}
    if(best&&chosen.length>=best.score[0])return;
    let target=null,opts=null;for(const m of ones)if(!covered.has(m)){const available=byM.get(m).filter(c=>!chosen.includes(c));if(!opts||available.length<opts.length){target=m;opts=available;}}
    if(!opts?.length)return;
    opts.forEach(c=>{const next=new Set(covered);c.covers.forEach(m=>next.add(m));search(next,[...chosen,c]);});
  }
  search(new Set(),[]);return best?best.chosen:[];
}
function checkAnswer(){if(!state.optimal){$('feedback').className='feedback bad';$('feedback').textContent='Build a valid map first.';return;}
  const target=targetSet(),covered=new Set(state.groups.flatMap(g=>g.cells).filter(m=>target.has(m))),missing=[...target].filter(m=>!covered.has(m));
  const invalid=state.groups.some(g=>g.cells.some(m=>!target.has(m)&&!state.dcs.has(m)));
  if(invalid||missing.length){$('feedback').className='feedback bad';$('feedback').textContent=invalid?`One of your groups includes a ${state.form==='SOP'?'0':'1'}. Remove it and try again.`:`Your groups still need to cover ${state.form==='SOP'?'minterm':'zero cell'}${missing.length===1?'':'s'} ${missing.join(', ')}.`;return;}
  const myLits=state.groups.reduce((s,g)=>s+[...g.pattern].filter(x=>x!=='-').length,0),optLits=state.optimal.reduce((s,g)=>s+g.literals,0),bestTerms=state.optimal.length;
  const isOptimal=state.groups.length===bestTerms&&myLits===optLits;
  $('feedback').className=`feedback ${isOptimal?'good':'bad'}`;
  $('feedback').textContent=isOptimal?`Correct — your expression is minimum (fewest terms, then fewest literals).`:'Your expression works, but it can be simplified further. Compare it with the minimum solution below.';
  $('answerPanel').hidden=false;$('answerTitle').textContent=isOptimal?'You found a minimum expression':'A smaller expression is possible';$('optimalExpression').textContent=expressionFor(state.optimal);$('answerDetail').textContent=`${bestTerms} ${state.form==='SOP'?'product':'sum'} term${bestTerms===1?'':'s'} · ${optLits} literal${optLits===1?'':'s'} · minimum ${state.form==='SOP'?'sum of products':'product of sums'}`;
}
function build(){try{const vars=$('variablesInput').value.split(/[\s,]+/).filter(Boolean);if(vars.length<2||vars.length>5)throw new Error('Use 2 to 5 variables.');if(vars.some(v=>!/^[A-Za-z][A-Za-z0-9_]*$/.test(v))||new Set(vars.map(v=>v.toLowerCase())).size!==vars.length)throw new Error('Use distinct variable names, such as A, B, C, D.');
  const max=2**vars.length,ones=parseList($('mintermsInput').value,max),dcs=parseList($('dontcaresInput').value,max);if(ones.some(x=>dcs.includes(x)))throw new Error('A minterm cannot also be a don’t-care.');
  state.vars=vars;state.form=$('formTypeSelect').value;renderLayoutControls(vars,true);state.ones=new Set(ones);state.dcs=new Set(dcs);state.selected.clear();state.groups=[];state.optimal=minimize([...targetSet()],dcs);
  $('inputMessage').className='input-message';$('inputMessage').textContent=`${vars.length} variables · ${max} map cells${dcs.length?` · ${dcs.length} don’t-care${dcs.length===1?'':'s'}`:''}`;$('feedback').textContent='';$('feedback').className='feedback';$('answerPanel').hidden=true;renderMap();renderGroups();updateSelection();
 }catch(e){$('inputMessage').className='input-message error';$('inputMessage').textContent=e.message;}}
function reset(){ $('variablesInput').value='A, B, C, D';$('mintermsInput').value='0, 2, 5, 7, 8, 10, 13, 15';$('dontcaresInput').value='';build(); }
$('buildButton').addEventListener('click',build);$('addGroupButton').addEventListener('click',addGroup);$('checkButton').addEventListener('click',checkAnswer);$('resetButton').addEventListener('click',reset);$('formTypeSelect').addEventListener('change',changeForm);
$('splitVariableSelect').addEventListener('change',applyLayoutControls);$('upperValueSelect').addEventListener('change',applyLayoutControls);
$('exampleButton').addEventListener('click',()=>{$('variablesInput').value='A, B, C, D, E';$('mintermsInput').value='1, 3, 5, 8, 9, 15, 16, 20, 21, 23, 27, 28, 31';$('dontcaresInput').value='';build();});
function showTab(name){const maps=name!=='quine';$('kmapView').hidden=!maps;$('quineView').hidden=maps;$('resetButton').hidden=!maps;$('kMapsTab').classList.toggle('active',maps);$('quineTab').classList.toggle('active',!maps);$('kMapsTab').setAttribute('aria-selected',String(maps));$('quineTab').setAttribute('aria-selected',String(!maps));history.replaceState(null,'',maps?'#k-maps':'#quine');}
$('kMapsTab').addEventListener('click',()=>showTab('maps'));$('quineTab').addEventListener('click',()=>showTab('quine'));$('backToMapsButton').addEventListener('click',()=>showTab('maps'));
if(location.hash==='#quine')showTab('quine');
['variablesInput','mintermsInput','dontcaresInput'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')build();}));
build();
