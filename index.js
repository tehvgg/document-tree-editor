/**
 * author / Patrick McGuckin
 * twitter / @pmcgooks
 * github / tehvgg
 */

/**
 * Prefixes for branches in the tree.
 * @property prefix
 */
const prefix = {
  node: '|--',
  node_last: '\\--',
  spacer_line: '|   ',
  spacer_empty: '    '
};

/**
 * Getters return new HTML elements for injection into the editor.
 * @property newNode
 */
const newNode = {
  get ul () {
    return document.createElement('ul');
  },
  get li () {
    return document.createElement('li');
  },
  get input () {
    let el = document.createElement('input');
    el.type = 'text';
    el.placeholder = 'Directory or File Name';
    return el;
  }
};

/**
 * Getters return an array of all matching elements in the editor.
 * @property domNodes
 */
const domNodes = {
  get input () {
    return nodeListToArray(document.querySelectorAll('#editor input'));
  }
};

// Element storage for quick access.
const editor = document.querySelector('#editor');
const btn = document.querySelector('#save');
const dropzone = document.querySelector('#dropzone');
const root = document.querySelector('#root');
const ntf = document.querySelector('.notification');
const output = document.querySelector('#output');
const listEntry = document.querySelector('#listEntry');
const options = {
  el: document.querySelector('#options'),
  addSibling: document.querySelector('.addSibling'),
  addChild: document.querySelector('.addChild'),
  moveBranch: document.querySelector('.moveBranch'),
  deleteBranch: document.querySelector('.deleteBranch')
};

// Global application variables.
let delayUpdate = false;
let movingBranch = false;
let timeout, activeBranch;

/**
 * Converts a NodeList to an Array and returns it.
 * @method nodeListToArray
 * @returns Array
 */
function nodeListToArray (list) {
  return Array.prototype.slice.call(list);
}

/**
 * Saves a string representation of the editor tree to the clipboard.
 * Requires a browser compatible with the execCommand() API.
 * @method saveToClipboard
 */
function saveToClipboard () {
  // the range node must be in the DOM to work, this output element is [display: none];
  output.textContent = treeToString();
  let range = document.createRange();
  range.selectNode(output);
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    ntf.className = 'notification success';
  } catch (e) {
    ntf.className = 'notification failed';
  }
  // display the notification for 3 seconds
  setTimeout(() => ntf.className = 'notification', 3000);
  window.getSelection().removeAllRanges();
}

/**
 * Converts the editor tree to string format.
 * @method treeToString
 * @returns String
 */
function treeToString () {
  let tree = root.value || root.placeholder;
  prefixer(listEntry, 0, function (item, prefix) {
    let input = item.firstElementChild;
    tree += `\n${prefix} ${input.value || input.placeholder}`;
  });
  return tree.trim();
}

/**
 * Applies necessary prefixes to the list items in the editor on update.
 * @method renderEditor
 */
function renderEditor () {
  prefixer(listEntry, 0, function (item, prefix) {
    item.dataset.prefix = prefix;
  });
}

/**
 * Recursively determines prefixes for each line in the tree.
 * 'processor()' is called for each line, handled by the calling method.
 * @method prefixer
 */
function prefixer (activeList, depth, processor, spacers = []) {
  let items = nodeListToArray(activeList.children);
  for (let i = 0, l = items.length; i < l; i++) {
    let last = i === l - 1;
    let activeItem = items[i];
    processor(activeItem, spacers.join('') + (last ? prefix.node_last : prefix.node));
    let nextList = activeItem.lastElementChild;
    if (nextList.tagName === 'UL') {
      let arr = spacers.slice();
      arr.push(last ? prefix.spacer_empty : prefix.spacer_line);
      prefixer(nextList, depth + 1, processor, arr);
    }
  }
}

function traverseFileTree (entry, branch) {
  branch.firstElementChild.value = entry.name;
  let reader = entry.createReader();
  reader.readEntries(entries => {
    for (let i = 0, l = entries.length; i < l; i++) {
      let item = entries[i];
      if (item.isDirectory) {
        traverseFileTree(item, addChild(branch));
      } else {
        addChild(branch).firstElementChild.value = item.name;
      }
    }
  }, error => console.error(error));
}

function parseDroppedFolder (event) {
  event.preventDefault();
  toggleEditorFade(event);
  let entry = event.dataTransfer.items[0].webkitGetAsEntry();
  if (entry.isDirectory) {
    while (listEntry.children.length) {
      listEntry.removeChild(listEntry.children[0]);
    }
    delayUpdate = true;
    traverseFileTree(entry, root.parentNode);
  }
  delayUpdate = false;
  update();
}

function toggleEditorFade (event) {
  !event.defaultPrevented && event.preventDefault();
	dropzone.className = event.type === 'dragover' ? 'active' : '';
}

/**
 * Each time a user hovers an input, display the context menu to the right of the element.
 * @method positionContextMenu
 */
function positionContextMenu (currentTarget) {
  cancelTimeout();
  activeBranch = currentTarget.parentNode;
  // Don't allow adding siblings or deleting the root.
  if (currentTarget.id === 'root') {
    options.addSibling.style.display = 'none';
    options.moveBranch.style.display = 'none';
    options.deleteBranch.style.display = 'none';
  } else {
    options.addSibling.style.display = null;
    options.moveBranch.style.display = null;
    options.deleteBranch.style.display = null;
  }
  let rect = currentTarget.getBoundingClientRect();
  options.el.className = 'active';
  options.el.style.left = `${rect.right + 5}px`;
  options.el.style.top = `${rect.top + scrollY}px`;
}

/**
 * Hide the context menu after 1 second.
 * @method hideContextMenu
 */
function hideContextMenu () {
  timeout = setTimeout(() => {
    options.el.className = '';
  }, 1000);
}

function doMoveBranch ({ currentTarget }) {
  let dest = currentTarget.parentNode;
  activeBranch.parentNode.removeChild(activeBranch);
  let ul = dest.lastElementChild;
  if (ul.tagName !== 'UL') {
    dest.appendChild(ul = newNode.ul);
  }
  ul.appendChild(activeBranch);
  movingBranch = false;
  currentTarget.className = '';
  activeBranch.className = '';
  update();
}

function handleBranchMouseOver ({ currentTarget }) {
  if (movingBranch) {
    currentTarget.className = 'move-destination';
    currentTarget.addEventListener('click', doMoveBranch);
  } else {
    positionContextMenu(currentTarget);
  }
}

function handleBranchMouseOut ({ currentTarget }) {
  if (movingBranch) {
    currentTarget.className = '';
    currentTarget.removeEventListener('click', doMoveBranch);
  } else {
    hideContextMenu();
  }
}

/**
 * Add a sibling branch to the active branch.
 * @method addSibling
 */
function addSibling (branch) {
  if (branch instanceof MouseEvent) { branch = activeBranch; }
  let ul = branch.parentNode;
  let li = newNode.li;
  li.appendChild(newNode.input);
  ul.appendChild(li);
  update();
  return li;
}

/**
 * Add a child branch to the active branch.
 * @method addChild
 */
function addChild (branch) {
  if (branch instanceof MouseEvent) { branch = activeBranch; }
  let ul = branch.lastElementChild;
  if (ul.tagName !== 'UL') {
    branch.appendChild(ul = newNode.ul);
  }
  let li = newNode.li;
  li.appendChild(newNode.input);
  ul.appendChild(li);
  update();
  return li;
}

function moveBranch (branch) {
  if (branch instanceof MouseEvent) { branch = activeBranch; }
  movingBranch = true;
  branch.className = 'moving';
  removeMenuListeners(branch);
}

/**
 * Delete the active branch and all of its children.
 * @method deleteBranch
 */
function deleteBranch (branch) {
  if (branch instanceof MouseEvent) { branch = activeBranch; }
  branch.parentNode.removeChild(branch);
  options.el.className = ''; // immediately hide menu.
  update();
}

/**
 * Clear the hide-menu timeout.
 * @method cancelTimeout
 */
function cancelTimeout () {
  clearTimeout(timeout);
}

/**
 * Remove and reapply hover listeners to all input elements and re-render the editor.
 * Called any time the context menu is used.
 * @method update
 */
function update () {
  if (delayUpdate) { return; }
  addMenuListeners();
  renderEditor();
}

function addMenuListeners (parent) {
  let nodes;
  if (!parent) {
    nodes = domNodes.input;
  } else {
    nodes = nodeListToArray(parent.querySelectorAll('input'));
  }
  nodes.forEach(node => {
    if (node.dataset.hasListeners) { return; }
    node.addEventListener('mouseover', handleBranchMouseOver);
    node.addEventListener('mouseout', handleBranchMouseOut);
    node.dataset.hasListeners = true;
  });
}

function removeMenuListeners (parent) {
  let nodes;
  if (!parent) {
    nodes = domNodes.input;
  } else {
    nodes = nodeListToArray(parent.querySelectorAll('input'));
  }
  nodes.forEach(node => {
    if (!node.dataset.hasListeners) { return; }
    node.removeEventListener('mouseover', handleBranchMouseOver);
    node.removeEventListener('mouseout', handleBranchMouseOut);
    delete node.dataset.hasListeners;
  });
}

// apply event listeners to the save button and context menu
btn.addEventListener('click', saveToClipboard);
options.el.addEventListener('mouseover', cancelTimeout);
options.el.addEventListener('mouseout', hideContextMenu);
options.addSibling.addEventListener('click', addSibling);
options.addChild.addEventListener('click', addChild);
options.moveBranch.addEventListener('click', moveBranch);
options.deleteBranch.addEventListener('click', deleteBranch);
dropzone.addEventListener('dragover', toggleEditorFade);
dropzone.addEventListener('dragleave', toggleEditorFade);
dropzone.addEventListener('drop', parseDroppedFolder);
// init
update();
