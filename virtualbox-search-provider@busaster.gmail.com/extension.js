/* Virtualbox Search Provider for Gnome Shell
 *
 * Copyright (c) 2012 Gianrico Busa
 *
 * This programm is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This programm is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const Main = imports.ui.main;
const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Util = imports.misc.util;

// Settings
const XML_MACHINE_ENTRY = '<MachineEntry .*/>';

// vboxSearchProvider holds the instance of the search provider
// implementation. If null, the extension is either uninitialized
// or has been disabled via disable().
var vboxSearchProvider = null;

function VirtualBoxSearchProvider() {
    this._init();
}

VirtualBoxSearchProvider.prototype = {
    __proto__: Search.SearchProvider.prototype,

    _init: function(name) {
        Search.SearchProvider.prototype._init.call(this, "VIRTUALBOX VIRTUAL MACHINES");
        
        let filename = '';
        this._virtualMachineFiles = [];
        this._virtualMachineNames = [];
        
        // the first thing to do i to look at the Virtuallbox configuration file, VirtualBox.xml, stored in $HOME/.VirtualBox
        // inside this file there's a section (Tag) "MachineRegistry" where the virtual machines are listed
        // We build a list of Known virtual machines in that way
        // then GLib.build_filenamev build a correct filename using a list of string parts
        filename = GLib.build_filenamev([GLib.get_home_dir(), '/.VirtualBox/', 'VirtualBox.xml']);
        // with the GIO function file_new_for_path we build a GIO file object with the given filename
        let configFile = Gio.file_new_for_path(filename);
        // using GIO method we monitor changing that happens on the configFile. The goal is to mantain a correct list of Vm's
        this.configMonitor = configFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.configMonitor.connect('changed', Lang.bind(this, this._onConfigChanged));
        // when initialized we fire an event of creation in order to fill the VM's list 
        this._onConfigChanged(null, configFile, null, Gio.FileMonitorEvent.CREATED);
    },

    _onConfigChanged: function(filemonitor, file, other_file, event_type) {
        if (!file.query_exists (null)) {
            this._virtualMachines = [];
            return;
        }

        if (event_type == Gio.FileMonitorEvent.CREATED ||
            event_type == Gio.FileMonitorEvent.CHANGED ||
            event_type == Gio.FileMonitorEvent.CHANGES_DONE_HINT)
        {
            // the config file is a xml file in wich we have to find the tag "MachineRegistry"
            // Inside this tag whe find N "MachineEntry" tags, each one with an attribute, "src", where the VM file full path is stored
            // I tried to use E4X but without luck. At that point I sue my parser            
            
            let content = String(file.load_contents(null)[1]);
            this._findMachines(content);
            this._virtualMachineNames=[];
            for (var i=0;i<this._virtualMachineFiles.length;i++)
            {
              let splittedPath=this._virtualMachineFiles[i].split('/');
              this._virtualMachineNames[i]=splittedPath[splittedPath.length-1].split('.')[0];
              //global.log('virtual machine name : '+this._virtualMachineNames[i])
            }
            //global.log('virtual machine name : '+this._virtualMachineNames.length)
        }
    },
    
    _findMachines: function(content) {
        this._virtualMachineFiles = [];
        let indexOfMachine =content.search(XML_MACHINE_ENTRY);
        let mi=0;
        let machine="";
        let startIndex=0;
        let endIndex=0;
        while(indexOfMachine>=0)
        {
          content=content.substring(indexOfMachine);  
          startIndex=content.indexOf('src=')+5;
          content=content.substring(startIndex);
          endIndex=content.indexOf('/>');
          machine=content.substring(0,endIndex);
          //global.log('machine= '+machine+'<br>');
          content=content.substring(1);
          indexOfMachine = content.search(XML_MACHINE_ENTRY);
          this._virtualMachineFiles[mi++]=machine;
        }
    },

    getResultMetas: function(resultIds) {
        let metas = [];

        for (let i = 0; i < resultIds.length; i++) {
            metas.push(this.getResultMeta(resultIds[i]));
        }
        return metas;
    },

    getResultMeta: function(resultId) {
        //global.log("getResultMeta called : resultId "+resultId.name);
        let appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app('virtualbox.desktop');

        return {'id': resultId,
                 'name': resultId.name,
                 'createIcon': function(size) {
                                   return app.create_icon_texture(size);
                               }
               };
    },

    activateResult: function(id) {
        global.log("Start bm : "+id.name);
        Util.spawn(['vboxmanage', 'startvm', id.name]);
    },

    getInitialResultSet: function(terms) {
        //global.log("getInitialResultSet called : terms "+terms);
        let searchResults = [];
        for (var i=0; i<this._virtualMachineNames.length; i++) {
            let searchTarget=this._virtualMachineNames[j]+" (VirtualBox VM)";
            for (var j=0; j<terms.length; j++) {
                //global.log("Check if "+searchTarget.toUpperCase()+" matches with "+terms[j].toUpperCase());
                try {
                    if (searchTarget.toUpperCase().match(terms[j].toUpperCase())) {
                        searchResults.push({
                            'name': this._virtualMachineNames[i],
                            'file': this._virtualMachineFiles[i]
                        });
                    }
                }
                catch(ex) {
                    continue;
                }
            }
        }
        if (searchResults.length > 0) {
            //global.log("have results : "+searchResults);
            return(searchResults);
        }
        //else
        //    global.log("NO results for "+term);

        return [];
    },

    getSubsearchResultSet: function(previousResults, terms) {
        return this.getInitialResultSet(terms);
    },
};

function init(meta) {
}

function enable() {
    if (vboxSearchProvider==null) {
		global.log('Activating vboxSearchProvider')
        vboxSearchProvider = new VirtualBoxSearchProvider();
        Main.overview.addSearchProvider(vboxSearchProvider);
    }
	else
		global.log('vboxSearchProvider NOT NULL and enabling : ERROR ?')
}

function disable() {
    if  (vboxSearchProvider!=null) {
		global.log('Disabling vboxSearchProvider')
        Main.overview.removeSearchProvider(vboxSearchProvider);
        vboxSearchProvider.configMonitor.cancel();
        vboxSearchProvider = null;
    }
	else
		global.log('vboxSearchProvider NULL and disabling : ERROR ?')
}

