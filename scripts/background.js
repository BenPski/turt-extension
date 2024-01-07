// wrapper around websocket connection
// keep in the service so it can be shared nicely
class Connection {
    constructor() {
        chrome.storage.local.get(['host', 'port', 'vault']).then((result) => {
            this.host = result.host;
            this.port = result.port;
            this.vault = result.vault;
        });
        this.websocket = null;
        this.connected = false;
        this.vaulted = false; //lol
        this.connect();
    }

    connect() {
        if (this.websocket === null) {
            try {
                this.websocket = new WebSocket(`ws://${this.host}:${this.port}`);
                this.websocket.onopen = (event) => {
                    console.log(`Connected to ${this.host} on ${this.port}`);
                    this.connection_succeeded();
                    this.send(JSON.stringify({'action': 'list'}), (event) => {
                        console.log(event);
                        var response = JSON.parse(event.data);
                        this.populate_vault_list(response);
                    })
                }
                this.websocket.onerror = (event) => {
                    console.log(`Failed to connect with ${this.host} and ${this.port}`);
                    this.connection_failed();
                    this.vault_deselected();
                }
                this.websocket.onclose = (event) => {
                    console.log("Closing connection");
                }
                this.websocket.onmessage = (event) => {
                    console.log(`received a message: ${event}`);
                }
            } catch (e) {
                this.websocket = null;
            }
        }
    }

    update_host(host) {
        this.host = host;
        this.connect();
    }

    update_port(port) {
        this.port = port;
        this.connect();
    }

    update_vault(vault) {
        this.vault = vault;
        console.log(`Selected ${this.vault}`);
        this.vault_selected();
        this.get_vault_entries();
    }

    send(data, handler) {
        if (this.websocket) {
            this.websocket.onmessage = handler
            this.websocket.send(data);
        }
    }

    create_vault(vault, password) {
        var data = {'action': 'create', 'vault': vault, 'password': password};
        this.send(JSON.stringify(data), (event) => {
            var response = JSON.parse(event.data);
            this.populate_vault_list(response);
        });
    }

    delete_vault(vault, password) {
        var data = {'action': 'delete', 'vault': vault, 'password': password};
        this.send(JSON.stringify(data), (event) => {
            var response = JSON.parse(event.data);
            this.populate_vault_list(response);
        });
    }

    get_vault_entries() {
        var data = {'action': 'vault_list', 'vault': this.vault};
        this.send(JSON.stringify(data), (event) => {
            var response = JSON.parse(event.data);
            this.populate_entry_list(response);
        });
    }

    get_data(entry, password, handler) {
        var data = {'action': 'get_entry', 'vault': this.vault, 'entry': entry, 'password': password};
        this.send(JSON.stringify(data), handler);
    }

    create_entry(entry, password, info) {
        var data = {'action': 'create_entry', 'vault': this.vault, 'entry': entry, 'password': password, 'data': info};
        this.send(JSON.stringify(data), (event) => {
            var response = JSON.parse(event.data);
            this.populate_entry_list(response);
        });
    }

    update_entry(entry, password, info) {
        var data = {'action': 'update_entry', 'vault': this.vault, 'entry': entry, 'password': password, 'data': info};
        this.send(JSON.stringify(data), (event) => {
            var response = JSON.parse(event.data);
            this.populate_entry_list(response);
        });
    }

    populate_vault_list(data) {
        chrome.storage.local.set({'available_vaults': data});
        if (data.length > 0) {
            this.update_vault(data.at(-1));
            chrome.storage.local.set({'vault': data.at(-1)});
        }
        /*
        vaults.replaceChildren();
        for (let vault of Object.entries(data)) {
            var entry = document.createElement('option');
            entry.value = vault[1];
            entry.textContent = vault[1];
            vaults.appendChild(entry);
        }
        if (data.length > 0) {
            this.update_vault(data.at(-1));
            vaults.value = data.at(-1);
        }
        */
    }

    populate_entry_list(data) {
        chrome.storage.local.set({'available_entries': data});
        /*
        entries.replaceChildren();
        for (let entry of data) {
            var item = document.createElement('option');
            item.value = entry;
            item.textContent = entry;
            entries.appendChild(item);
        }
        if (data.length > 0) {
            entries.value = data.at(-1);
        }
        */
    }

    connection_succeeded() {
        chrome.action.setBadgeText({text: ""});
        chrome.action.setTitle({title: ""});
    }

    connection_failed() {
        chrome.action.setBadgeText({text: "!"});
        chrome.action.setBadgeBackgroundColor({color: "#F00"});
        chrome.action.setTitle({title: "Failed to connect to server."});
    }

    vault_selected() {
        chrome.action.setBadgeText({text: ""});
        chrome.action.setTitle({title: ""});
    }

    vault_deselected() {
        chrome.action.setBadgeText({text: "!"});
        chrome.action.setBadgeBackgroundColor({color: "#F00"});
        chrome.action.setTitle({title: "No vault selected."});
    }

}

function get_inputs() {
    var data = {};
    var text_inputs = document.querySelectorAll('input[type="text"]');
    var password_inputs = document.querySelectorAll('input[type="password"]');

    for (let item of text_inputs) {
        data[item.id] = item.value;
    }
    for (let item of password_inputs) {
        data[item.id] = item.value;
    }
    return {'data': data, 'path': window.location.href};
}

function set_inputs(data) {
    for (let item of Object.entries(data)) {
        console.log(item);
        try {
            document.getElementById(item[0]).value = item[1];
        } catch (e) {
        }
    }
}

var connection = new Connection();

chrome.runtime.onInstalled.addListener(() => {
    console.log("install event")
    connection.connect();
});


chrome.action.onClicked.addListener((tab) => {
    chrome.action.setPopup({popup: 'main.html'});
    //chrome.action.openPopup();
});


chrome.runtime.onStartup.addListener(() => {
    console.log("connection event");
    connection.connect();
});


// ensure connection exists and handle message sent
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`received ${message}`);
    if (message.action == 'update_host') {
        connection.update_host(message.host);
    } else if (message.action == 'update_port') {
        connection.update_port(message.port);
    } else if (message.action == 'update_vault') {
        connection.update_vault(message.vault);
    } else if (message.action == 'create_vault') {
        connection.create_vault(message.vault, message.password);
    } else if (message.action == 'delete_vault') {
        connection.delete_vault(message.vault, message.password);
    } else if (message.action == 'open_popup') {
        chrome.tabs.query({active: true, lastFocusedWindow: true}).then((result) => {
            var tab = result[0];
            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func: get_inputs,
            }).then((injectionResult) => {
                for (const frameResult of injectionResult) {
                    const {frameId, result} = frameResult;
                    console.log(result);
                    console.log("backgroun", result);
                    sendResponse(result);
                }
            });
        });
    } else if (message.action == 'update_entry') {
        connection.update_entry(message.entry, message.password, message.data);
    } else if (message.action == 'create_entry') {
        connection.create_entry(message.entry, message.password, message.data);
    } else if (message.action == 'fill_entry') {
        console.log("filling")
        chrome.tabs.query({active: true, lastFocusedWindow: true}).then((result) => {
            var tab = result[0];
            connection.get_data(message.entry, message.password, (event) => {
                var response = JSON.parse(event.data);
                console.log("setting", response);
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: set_inputs,
                    args: [response],
                });
            });
        });
    }
    /*
    if (message.service == 'popup_opened') {
        do_setup();
    } else if (message.startsWith('create-vault')) {
        let vault = message.split(':')[1];
        let password = message.split(':')[2];
        create_vault(vault, password);
    } else if (message.startsWith('delete-vault')) {
        let vault = message.split(':')[1];
        let password = message.split(':')[2];
        delete_vault(vault, password);
    } else if (message.service === 'page_loaded') {
        do_setup();
    }
    */
    return true;

});

/*
// if some config changed do something about it
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(`in ${namespace} ${key} changed from ${oldValue} to ${newValue}`);
    }
    if (namespace == 'local') {
        for (let [key, {oldValue, newValue }] of Object.entries(changes)) {
            if (key == 'host' || key == 'port') {
                get_vaults();
            }
        }
    }
});

async function getTabId() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab.id;
}

function get_vaults() {
    var message = JSON.stringify({'action': 'list'});
    send_message(message, (event) => {
        var result = JSON.parse(event.data);
        chrome.storage.local.set({'available_vaults': result})
        // if only one vault set it as the selected vault
        if (result.length == 1) {
            chrome.storage.local.set({'vault': result[0]});
        } else if (result.length == 0) {
            chrome.storage.local.set({'vault': null});
        }
    });
}

function get_entries() {
    chrome.storage.local.get(['vault']).then((result) => {
        var message = JSON.stringify({'action': 'vault_list', 'vault': result.vault});
        send_message(message, (event) => {
            var result = JSON.parse(event.data);
            chrome.storage.local.set({'vault_entries': result})
        });
    });
}
function create_vault(vault, password) {
    var message = JSON.stringify({'action': 'create', 'vault': vault, 'password': password});
    send_message(message, (event) => {
        var result = JSON.parse(event.data);
        chrome.storage.local.set({'available_vaults': result});
        // if the newly created vault is part of the available vaults set it as the selected vault
        if (result.includes(vault)) {
            chrome.storage.local.set({'vault': vault});
        }
    });
}

function delete_vault(vault, password) {
    var message = JSON.stringify({'action': 'delete', 'vault': vault});
    send_message(message, (event) => {
        var result = JSON.parse(event.data);
        chrome.storage.local.set({'available_vaults': result});
        // if the currently selected vault was deleted set the selected vault to null
        if (!result.includes(vault)) {
            chrome.storage.local.get(['vault']).then((result) => {
                if (result.vault == vault) {
                    default_vault();
                }
            });
        }
    });
}

function available_entries(vault, password) {
    var message = JSON.stringify({'action': 'list_entries', 'vault': vault, 'password': password});
    send_message(message, (event) => {
        chrome.storage.local.set({'available_entries': JSON.parse(event.data)});
    });
}

function create_entry(vault, password, name, data) {
    var message = JSON.stringify({'action': 'create_entry', 'vault': vault, 'password': password, 'name': name, 'data': data});
    send_message(message, (event) => {
        console.log(`created entry for ${name} in ${vault}`);
        chrome.storage.local.set({'available_entries': JSON.parse(event.data)});
    });
}

function retrieve_entry(vault, password, name) {
    var message = JSON.stringify({'action': 'get_entry', 'vault': vault, 'password': password, 'name': name});
    send_message(message, (event) => {
        data = JSON.parse(event.data);
        //fill_data(data);
    });
}
async function create_websocket() {
    var websocket = null;
    var uri = await chrome.storage.local.get(["host", "port"]).then((result) => {
        return `ws://${result.host}:${result.port}`;
    });
    websocket = new WebSocket(uri);
    return websocket;
};

async function send_message(message, handle_response) {
    var websocket = await create_websocket();
    websocket.onopen = (event) => {
        console.log('websocket open');
        chrome.storage.local.set({'connected': true});
        websocket.send(message);
    };

    websocket.onmessage = (event) => {
        console.log(`websocket received message: ${event.data}`);
        handle_response(event);
    };

    websocket.onclose = (event) => {
        console.log('websocket closed');
        websocket = null;
    };

    websocket.onerror = (event) => {
        console.log("error opening websocket");
        alert_badge("Could not connect to server.");
        chrome.storage.local.set({'connected': false});
    };
   
}

*/
