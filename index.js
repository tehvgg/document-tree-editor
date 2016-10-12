/**
 * author / Patrick McGuckin
 * twitter / @pmcgooks
 * github / tehvgg
 */

 /*************************************************************************

   UTILS & GLOBALS

 *************************************************************************/

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
     el.type = 'text'; el.placeholder = 'Directory or File Name';
     return el;
   }
 };

 /**
  * Converts a NodeList to an Array and returns it.
  * @method nodeListToArray
  * @returns Array
  */
 function nodeListToArray (list) {
   return Array.prototype.slice.call(list);
 }

/**
 * Shorthand for binding scope to a function.
 * @return {Function}
 */
 function proxy (func, scope) {
   return func.bind(scope);
 }

 /*************************************************************************

   PREFIX

 *************************************************************************/

/**
 * Watches the prefix input fields for changes, storing any updates for use by the editor.
 */
const prefix = {
  branch: '|--',
  branch_last: '\\--',
  spacer_branch: '|   ',
  spacer_empty: '    ',
  els: {
    branch: document.querySelector('.branch'),
    branch_last: document.querySelector('.branch-last'),
    spacer_branch: document.querySelector('.spacer-branch'),
    spacer_empty: document.querySelector('.spacer-empty')
  },
  /**
   * Populate the inputs with the default prefixes.
   * @method init
   */
  init () {
    for (let name in this.els) {
      this.els[name].value = this[name];
    }
    this.watch();
  },
  /**
   * Watch inputs for updates.
   * @method watch
   */
  watch () {
    for (let name in this.els) {
      this.els[name].addEventListener('change', proxy(this._handleChange, this));
    }
  },
  /**
   * Store updated values.
   * @method _handleChange
   * @private
   */
  _handleChange ({ target }) {
    let name = target.className.replace('-', '_');
    this[name] = target.value;
    editor.update();
  }
};

/*************************************************************************

  EDITOR

*************************************************************************/

/**
 * Manage the editor components and rendering.
 */
const editor = {
  el: document.querySelector('#editor'),
  root: document.querySelector('#root'),
  listEntry: document.querySelector('#listEntry'),
  contextMenu: {
    el: document.querySelector('#contextMenu'),
    addSibling: document.querySelector('.addSibling'),
    addChild: document.querySelector('.addChild'),
    moveBranch: document.querySelector('.moveBranch'),
    deleteBranch: document.querySelector('.deleteBranch')
  },
  delayUpdate: false,
  inMoveState: false,
  timeout: null,
  activeBranch: null,
  /**
   * Fetch all inputs in the editor.
   * @return {Array}.
   */
  get allInputs () {
    let inputs = this.el.querySelectorAll('input');
    return nodeListToArray(inputs);
  },
  /**
   * Initialize the editor.
   * @method init
   */
  init () {
    this.watch();
    this.update();
  },
  /**
   * Listen for interactions with the context menu.
   * @method watch
   */
  watch () {
    let menu = this.contextMenu;
    menu.el.addEventListener('mouseover', proxy(this.clearTimeout, this));
    menu.el.addEventListener('mouseout', proxy(this._hideContextMenu, this));
    // event handlers are wrapped because we don't want the event parameter.
    menu.addSibling.addEventListener('click', event => this.addSibling(this.activeBranch));
    menu.addChild.addEventListener('click', event => this.addChild(this.activeBranch));
    menu.moveBranch.addEventListener('click', event => this.moveBranch(this.activeBranch));
    menu.deleteBranch.addEventListener('click', event => this.deleteBranch(this.activeBranch));
  },
  /**
   * Convert the tree to a string format.
   * @method toString
   * @returns {String}
   */
  toString () {
    let tree = root.value || root.placeholder;
    this._prefix(listEntry, 0, (item, prefix) => {
      let input = item.firstElementChild;
      tree += `\n${prefix} ${input.value || input.placeholder}`;
    });
    return tree.trim();
  },
  /**
   * Render the tree in the editor.
   * @method render
   */
  render () {
    this._prefix(listEntry, 0, (item, prefix) => {
      item.dataset.prefix = prefix;
    });
  },
  /**
   * Update the editor to the latest state.
   * @method update.
   */
  update () {
    if (this.delayUpdate) { return; }
    this._addMenuListeners();
    this.render();
  },
  /**
   * Clear the hide-menu timeout.
   * @method cancelTimeout
   */
  clearTimeout () {
    clearTimeout(this.timeout);
  },
  /**
   * Add a sibling branch to the active branch.
   * @method addSibling
   * @return {HTMLListItemElement} The added sibling.
   */
  addSibling (branch) {
    let ul = branch.parentNode;
    let li = newNode.li;
    li.appendChild(newNode.input);
    ul.appendChild(li);
    this.update();
    return li;
  },
  /**
   * Add a child branch to the active branch.
   * @method addChild
   * @return {HTMLListItemElement} The added child.
   */
  addChild (branch) {
    let ul = branch.lastElementChild;
    if (ul.tagName !== 'UL') {
      branch.appendChild(ul = newNode.ul);
    }
    let li = newNode.li;
    li.appendChild(newNode.input);
    ul.appendChild(li);
    this.update();
    return li;
  },
  /**
   * Move a branch to a new parent.
   * @method moveBranch
   */
  moveBranch (branch) {
    this.inMoveState = true;
    branch.className = 'moving';
    // don't want events for any item inside the moving branch
    this._removeMenuListeners(branch);
  },
  /**
   * Delete the active branch and all of its children.
   * @method deleteBranch
   */
  deleteBranch (branch) {
    branch.parentNode.removeChild(branch);
    this.contextMenu.el.className = ''; // immediately hide menu.
    this.update();
  },
  /**
   * Remove all branches save for the root.
   * @method clear
   */
  clear () {
    let list = this.listEntry;
    let children = list.children;
    while (children.length) {
      list.removeChild(children[0]);
    }
  },
  /**
   * Position the context menu next to the active branch.
   * @method _positionContextMenu
   * @private
   */
  _positionContextMenu (target) {
    this.clearTimeout();
    this.activeBranch = target.parentNode; // target is the input element.
    let menu = this.contextMenu;
    // Don't allow adding siblings or deleting the root.
    if (target.id === 'root') {
      menu.addSibling.style.display = 'none';
      menu.moveBranch.style.display = 'none';
      menu.deleteBranch.style.display = 'none';
    } else {
      menu.addSibling.style.display = null;
      menu.moveBranch.style.display = null;
      menu.deleteBranch.style.display = null;
    }
    let { right, top } = target.getBoundingClientRect();
    let el = menu.el;
    el.className = 'active';
    el.style.left = `${right + 5}px`;
    el.style.top = `${top + scrollY}px`;
  },
  /**
   * Hide the context menu after 1 second.
   * @method _hideContextMenu
   * @private
   */
  _hideContextMenu () {
    this.timeout = setTimeout(() => this.contextMenu.el.className = '', 1000);
  },
  /**
   * Re-parent the active branch to the target branch.
   * @method _moveBranch
   * @private
   */
  _moveBranch ({ currentTarget }) {
    let dest = currentTarget.parentNode;
    let activeBranch = this.activeBranch;
    activeBranch.parentNode.removeChild(activeBranch);
    let ul = dest.lastElementChild;
    if (ul.tagName !== 'UL') {
      dest.appendChild(ul = newNode.ul);
    }
    ul.appendChild(activeBranch);
    this.inMoveState = false;
    currentTarget.parentNode.className = activeBranch.className = '';
    this.update();
  },
  /**
   * Delegate branch interaction based on state.
   * @method _handleBranchMouseOver
   * @private
   */
  _handleBranchMouseOver ({ currentTarget }) {
    if (this.inMoveState) {
      currentTarget.parentNode.className = 'move-destination';
      currentTarget.addEventListener('click', currentTarget.clickListener = proxy(this._moveBranch, this));
    } else {
      this._positionContextMenu(currentTarget);
    }
  },
  /**
   * Delegate branch interaction based on state.
   * @method _handleBranchMouseOut
   * @private
   */
  _handleBranchMouseOut ({ currentTarget }) {
    if (this.inMoveState) {
      currentTarget.parentNode.className = '';
      currentTarget.removeEventListener('click', currentTarget.clickListener);
    } else {
      this._hideContextMenu();
    }
  },
  /**
   * Add interaction listeners to branches.
   * @method _addMenuListeners
   * @private
   */
  _addMenuListeners (parent) {
    let nodes;
    if (!parent) { nodes = this.allInputs; }
    else { nodes = nodeListToArray(parent.querySelectorAll('input')); }
    nodes.forEach(node => {
      if (node.dataset.hasListeners) { return; }
      node.addEventListener('mouseover', node.mouseoverListener = proxy(this._handleBranchMouseOver, this));
      node.addEventListener('mouseout', node.mouseoutListener = proxy(this._handleBranchMouseOut, this));
      node.dataset.hasListeners = true;
    });
  },
  /**
   * Remove interaction listeners on branches.
   * @method _removeMenuListeners
   * @private
   */
  _removeMenuListeners (parent) {
    let nodes;
    if (!parent) { nodes = this.allInputs; }
    else { nodes = nodeListToArray(parent.querySelectorAll('input')); }
    nodes.forEach(node => {
      if (!node.dataset.hasListeners) { return; }
      node.removeEventListener('mouseover', node.mouseoverListener);
      node.removeEventListener('mouseout', node.mouseoutListener);
      delete node.dataset.hasListeners;
    });
  },
  /**
   * Calculate prefixes per line.
   * @method _prefix
   * @private
   */
  _prefix (activeList, depth, processor, spacers = []) {
    let items = nodeListToArray(activeList.children);
    for (let i = 0, l = items.length; i < l; i++) {
      let last = i === l - 1;
      let activeItem = items[i];
      processor(activeItem, spacers.join('') + (last ? prefix.branch_last : prefix.branch));
      let nextList = activeItem.lastElementChild;
      if (nextList.tagName === 'UL') {
        let arr = spacers.slice();
        arr.push(last ? prefix.spacer_empty : prefix.spacer_branch);
        this._prefix(nextList, depth + 1, processor, arr);
      }
    }
  }
}

/*************************************************************************

  FOLDER DROP

*************************************************************************/

/**
 * Manage folder drops and subsequent calls to the editor.
 */
const folder = {
  dropzone: document.querySelector('#dropzone'),
  /**
   * Initialize the component.
   * @method init
   */
  init () {
    this.watch();
  },
  /**
   * Apply drag and drop related event listeners to the dropzone.
   * @method watch
   */
  watch () {
    // drop targets require a dragover and drop event to be considered valid.
    this.dropzone.addEventListener('dragover', proxy(this._toggleHover, this));
    this.dropzone.addEventListener('dragleave', proxy(this._toggleHover, this));
    this.dropzone.addEventListener('drop', proxy(this._handleDrop, this));
  },
  /**
   * Handle the file drop.
   * @method _handleDrop
   * @private
   */
  _handleDrop (event) {
    event.preventDefault();
    this._toggleHover(event);
    let entry = event.dataTransfer.items[0].webkitGetAsEntry();
    if (entry.isFile) { return; }
    editor.clear();
    editor.delayUpdate = true;
    this._traverse(entry, editor.root.parentNode);
    editor.delayUpdate = false;
    editor.update();
  },
  /**
   * Traverse the directory tree using the File System API, adding to the editor along the way.
   * @method _traverse
   * @private
   */
  _traverse (entry, branch) {
    branch.firstElementChild.value = entry.name;
    let reader = entry.createReader();
    reader.readEntries(entries => {
      for (let i = 0, l = entries.length; i < l; i++) {
        let item = entries[i];
        if (item.isDirectory) {
          this._traverse(item, editor.addChild(branch));
        } else {
          editor.addChild(branch).firstElementChild.value = item.name;
        }
      }
    }, e => {
      if (e.name === 'EncodingError') {
        console.error('Folder drops do not work from a local file system (url \'file://\'...). A live version can be found at https://tehvgg.github.io/document-tree-editor/');
      } else {
        console.error(e);
      }
    });
  },
  /**
   * Modify the visual state of the dropzone.
   * @method _toggleHover
   * @private
   */
  _toggleHover (event) {
    !event.defaultPrevented && event.preventDefault();
  	this.dropzone.className = event.type === 'dragover' ? 'active' : '';
  }
};

/*************************************************************************

  BUTTONS

*************************************************************************/

const saveBtn = document.querySelector('#save');
const clearBtn = document.querySelector('#clear');
const demoBtn = document.querySelector('#demo');
const output = document.querySelector('#output');
const req = new XMLHttpRequest();
req.open('GET', 'demo.txt');

/**
 * Saves a string representation of the editor tree to the clipboard.
 * Requires a browser compatible with the execCommand() API.
 * @method saveToClipboard
 */
function saveToClipboard () {
  // the range node must be in the DOM to work, this output element is [display: none];
  output.textContent = editor.toString();
  let range = document.createRange();
  range.selectNode(output);
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    saveBtn.className = 'success';
  } catch (e) {
    saveBtn.className = 'failed';
  }
  // display for 3 seconds
  setTimeout(() => saveBtn.className = '', 1500);
  window.getSelection().removeAllRanges();
}
saveBtn.addEventListener('click', saveToClipboard);

function clear () {
  editor.clear();
}
clearBtn.addEventListener('click', clear);

function demo () {
  let parent = editor.listEntry.parentNode;
  parent.removeChild(editor.listEntry);
  parent.innerHTML += req.responseText;
}
req.onreadystatechange = function _handleReadyStateChange () {
  demoBtn.addEventListener('click', demo);
};
req.send();

/*************************************************************************

  INIT

*************************************************************************/

prefix.init();
editor.init();
folder.init();
