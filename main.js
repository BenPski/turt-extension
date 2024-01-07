var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });
}

const host = document.getElementById('host');
const port = document.getElementById('port');
const vaults = document.getElementById('vaults');
const vault_edit = document.getElementById('vault_edit');
const password_edit = document.getElementById('password_edit');
const create_vault = document.getElementById('create_vault');
const delete_vault = document.getElementById('delete_vault');
const entries = document.getElementById('entries');
const action = document.getElementById('action');


host.addEventListener("input", (event) => {
    var val = event.target.value;
    chrome.storage.local.set({'host': val});
    chrome.runtime.sendMessage({'action': 'update_host', 'host': val});
})

port.addEventListener("input", (event) => {
    var val = event.target.value;
    chrome.storage.local.set({'port': val});
    chrome.runtime.sendMessage({'action': 'update_port', 'port': val});
})

vaults.addEventListener("input", (event) => {
    var val = event.target.value;
    chrome.storage.local.set({'vault': val});
    chrome.runtime.sendMessage({'action': 'update_vault', 'vault': val});
})

vault_edit.addEventListener("input", (event) => {
    var val = event.target.value;
    chrome.storage.local.get(['available_entries']).then((result) => {
        var entries = result.available_entries;
        if (entries.includes(val)) {
            create_vault.setAttribute('disabled','');
            delete_vault.removeAttribute('disabled');
        } else {
            create_vault.removeAttribute('disabled');
            delete_vault.setAttribute('disabled','');
        }
    });
})

create_vault.addEventListener("click", (event) => {
    var vault = vault_edit.value;
    var password = password_edit.value;
    chrome.runtime.sendMessage({'action': 'create_vault', 'vault': vault, 'password': password});
    vault_edit.value = "";
    password_edit.value = "";
})

delete_vault.addEventListener("click", (event) => {
    var vault = vault_edit.value;
    var password = password_edit.value;
    chrome.runtime.sendMessage({'action': 'delete_vault', 'vault': vault, 'password': password});
    vault_edit.value = "";
    password_edit.value = "";
})


// setup the popup with the values currently in storage
function setCurrent() {
    chrome.storage.local.get(["host", "port", "available_vaults", "vault", "available_entries"]).then((result) => {
        
        if (result.host !== undefined) {
            host.value = result.host;
        } else {
            host.value = 'localhost'; //default, probably not needed
        }

        if (result.port !== undefined) {
            port.value = result.port;
        } else {
            port.value = '5490'; //default, probably not needed
        }

        if (result.available_vaults) {
            for (let vault of Object.entries(result.available_vaults)) {
                var vault_item = document.createElement('option');
                vault_item.textContent = vault[1];
                vault_item.setAttribute('value', vault[1]);
                vaults.appendChild(vault_item);
            }
        }

        if (result.vault !== undefined) {
            vaults.value = result.vault;
        }

        if (result.available_entries !== undefined) {
            for (let entry of Object.entries(result.available_entries)) {
                var entry_item = document.createElement('option');
                entry_item.textContent = entry[1];
                entry_item.setAttribute('value', entry[1]);
                entries.appendChild(entry_item);
            }
        }

    });

};

function get_inputs() {
    var all_text_inputs = document.querySelectorAll('input[type="text"]');
    var all_password_inputs = document.querySelectorAll('input[type="password"]');
    var data = {};
    for (var i=0; i<all_text_inputs.length; i++) {
        var id = all_text_inputs[i].id;
        var value = all_text_inputs[i].value;
        data[id] = value;
    }
    for (var i=0; i<all_password_inputs.length; i++) {
        var id = all_password_inputs[i].id;
        var value = all_password_inputs[i].value;
        data[id] = value;
    }
    return data;
}

async function getTabId() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab.id;
}

// need to inject the code
async function get_page_inputs() {
    return await chrome.scripting.executeScript({
        target: {tabId: await getTabId()},
        func: get_inputs,
    }).then((injectionResult) => {
        for (const {_, result} of injectionResult) {
            return result;
        }
    });
}

function get_site_info() {
    var site = window.location;
    var url = site.href;
    var label = site.hostname.split(-2,-1);
    return { name: label, path: url };
}

async function get_path_to_entry() {
    return await chrome.storage.local.get(["path_to_entry"]).then((result) => {
        if (result.path_to_entry === undefined) {
            return {};
        } else {
            return result.path_to_entry;
        }
    });
}

async function determine_action() {
    var site = get_site_info();
    var url = site.path;
    var default_label = site.name;
    var input_data = await get_page_inputs();
    var path_to_entry = await get_path_to_entry();
    
    // if nothing is populated see if something can be pulled for the website
    // if something is populated and nothing is defined for the website create an entry
    // if something is populated and something is defined for the website update the entry
    // if nothing is populated and nothing can be pulled suggest entering some info
    
    var known_entry = url in path_to_entry;

    console.log(input_data);
    var populated = false;
    for (let id in input_data) {
        console.log(id, input_data[id]);
        if (input_data[id] != '') {
            populated = true;
        }
    }
    if (populated) {
        chrome.storage.local.get(["available_entries"]).then((result) => {
            if (known_entry) {
                // update entry
                console.log("Create update action");
                var label = path_to_entry[url];
            } else {
                // create new entry
                console.log("Create create action");
                var label = default_label;
                var section_title = document.createElement('p');
                section_title.textContent = "Create new entry";
                var form = document.createElement('form');
                var entry_name = document.createElement('input');
                entry_name.type = "text";
                entry_name.value = label;
                entry_name.id = "new_entry";
                var password = document.createElement('input');
                password.type = "password";
                password.placeholder = "Vault password";
                var submit = document.createElement('input');
                submit.type = "submit";
                submit.value = "create";
                action_space.appendChild(section_title);
                form.appendChild(entry_name);
                form.appendChild(password);
                form.appendChild(submit);
                action_space.appendChild(form);
            }

        });
    } else {
        if (known_entry) {
            // no entry yet, can't do anything
            console.log("Create no action");
            var notif = document.createElement('p');
            notif.textContent = "Didn't find any known entries or inputs, try filling in some information";
            action_space.appendChild(notif);
        } else {
            // populate inputs
            console.log("Create populate action");
            var label = path_to_entry[url];

        }
    }

}

function no_action() {
    action.replaceChildren();
    var notif = document.createElement('p');
    notif.textContent = "No matches and no inputs found, try entering some data."
    action.appendChild(notif);
}

function fill_action(entry) {
    action.replaceChildren();
    var notif = document.createElement('p');
    notif.textContent = `Fill in: ${entry}`;
    var password = document.createElement('input');
    password.setAttribute('type', 'password');
    password.setAttribute('placeholder', 'Vault password');
    password.setAttribute('id', 'action_password');
    var button = document.createElement('button');
    button.textContent = "go";
    action.appendChild(notif);
    action.appendChild(password);
    action.appendChild(button);
    button.addEventListener("click", (event) => {
        var vault_password = document.getElementById('action_password').value;
        chrome.runtime.sendMessage({'action': 'fill_entry', 'entry': entry, 'password': vault_password});
        document.getElementById('action_password').value = '';
    });

}

function create_action(data, path) {
    action.replaceChildren();

    var default_entry = path.split('.').at(-2);

    var notif = document.createElement('p');
    notif.textContent = "Create new entry:";
    var entry_input = document.createElement('input');
    entry_input.setAttribute('type', 'text');
    entry_input.setAttribute('id', 'action_entry');
    entry_input.value = default_entry;
    var password = document.createElement('input');
    password.setAttribute('type', 'password');
    password.setAttribute('placeholder', 'Vault password');
    password.setAttribute('id', 'action_password');
    var button = document.createElement('button');
    button.textContent = "go";
    action.appendChild(notif);
    action.appendChild(entry_input);
    action.appendChild(password);
    action.appendChild(button);

    button.addEventListener("click", (event) => {
        var entry = document.getElementById("action_entry").value;
        var password = document.getElementById("action_password").value;
        chrome.storage.local.get(['path_mapping']).then((result) => {
            var mapping = result.path_mapping;
            if (!mapping) {
                mapping = {};
            }
            mapping[path] = entry;
            chrome.storage.local.set({'path_mapping': mapping});
        });
        chrome.runtime.sendMessage({'action': 'create_entry', 'entry': entry, 'password': password, 'data': data});
        document.getElementById('action_entry').value = '';
        document.getElementById('action_password').value = '';
    });
}

function update_action(data, entry) {
    action.replaceChildren();

    var notif = document.createElement('p');
    notif.textContent = `Update ${entry} with current inputs?`;
    var password = document.createElement('input');
    password.setAttribute('type', 'password');
    password.setAttribute('placeholder', 'Vault password');
    password.setAttribute('id', 'action_password');
    var button = document.createElement('button');
    button.textContent = "go";
    action.appendChild(notif);
    action.appendChild(password);
    action.appendChild(button);

    button.addEventListener("click", (event) => {
        var password = document.getElementById("action_password").value;
        chrome.runtime.sendMessage({'action': 'update_entry', 'entry': entry, 'password': password, 'data': data});
        document.getElementById('action_password').value = '';
    });

}

function make_action(data, path) {
    chrome.storage.local.get(["available_entries", "path_mapping"]).then((result) => {
        var entry_list = result.available_entries;
        var mapping = result.path_mapping;
        if (!mapping) {
            mapping = {};
        }

        var populated = false;
        var known = path in mapping;

        console.log("inputs", data);
        console.log("entries", entry_list);
        console.log("mapping", mapping);
        console.log("path", path);


        for (let item of Object.entries(data)) {
            if (item[1] != '') {
                populated = true;
            }
        }  

        console.log(populated, known);
        // if not populated and not known -> no action
        // if not populated and known -> fill action
        // if populated and not known -> create action
        // if populated and known -> update action

        if (!populated && !known) {
            no_action();
        } else if (populated && !known) {
            create_action(data, path);
        } else if (known) {
            var entry = mapping[path];
            fill_action(entry);
        //} else if (populated && known) {
        //    var entry = mapping[path];
        //    update_action(data, entry);
        }
    });
}

chrome.runtime.sendMessage({'action': 'open_popup'}, (response) => {
    console.log("popup", response);
    var data = response.data;
    var path = response.path;
    make_action(data, path);
});
setCurrent();


