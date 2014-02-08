/*
 * VirtualBox search provider for Gnome shell 
 * Copyright (C) 2013 Gianrico Busa <busaster@gmail.com>
 * 
 * VirtualBox search provider is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * VirtualBox search provider is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Thanks to gnekoz for his "VirtualBox machines launcher for Gnome shell" extension from which I took 
 * the new search engine based on vboxmanage invocation. 
 */

const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Params = imports.misc.params;
const Util = imports.misc.util;
const Lang = imports.lang;
const IconGrid = imports.ui.iconGrid;
const GLib = imports.gi.GLib;

const ExtensionUUID = "virtualbox-search-provider@busaster.gmail.com";

let provider = null;

const VirtualBoxIconBin = new Lang.Class({
    Name: 'VirtualBoxIconBin',

    _init: function(name) {
        this.actor = new St.Bin({ reactive: true,
                                  track_hover: true });
        this.icon = new IconGrid.BaseIcon(name,
                                          { showLabel: true,
                                            createIcon: Lang.bind(this, this.createIcon), } );

        this.actor.child = this.icon.actor;
        this.actor.label_actor = this.icon.label;
    },

    createIcon: function (size) {
        let box = new Clutter.Box();
        let icon = new St.Icon({ icon_name: 'virtualbox',
                                 icon_size: size });
        box.add_child(icon);
        return box;
    }
});


const VBoxMachinesSearchProvider = new Lang.Class({
    Name: 'VBoxMachinesSearchProvider',

    _init: function (name) {
        this.id = 'VBoxMachines';
    },
    
    createIcon: function (name) {
        return new VirtualBoxIconBin(name);
    },

    createResultActor: function (result, terms) {
        let icon = this.createIcon(result.name);
        return icon.actor;
    },

    getResultMeta: function (elem) {
        return { id: elem.id,
                 name: elem.name
               };
    },
    
    _getResultSet: function (results, terms) {
		var vms;
		
		try {
			vms = String(GLib.spawn_command_line_sync('vboxmanage list vms')[1]);
		} catch (err) {	
		   Main.notifyError("VirtualBox machines launcher : " + err.message);		
			return;
		}
		var mainRegExp = new RegExp('\"(.*' + terms + '.*)"\ *\{.*\}','mi');
		var singleRegExp = new RegExp('\{.*\}','mi');
		var matches = null;
		var results = new Array();
		//log('vms>'+vms);
		// multiple matches are not handled by RegEx so I remove the matched value from the orignal string and 
      // loop until mathse is not null		
		do {
		 matches = mainRegExp.exec(vms);		 
       if (matches!=null) {
         //log('partialM> '+matches[0]); 		          
		   vms=vms.substring(vms.indexOf(matches[0])+matches[0].length);
		   var vmid=singleRegExp.exec(matches[0]);
		   results.push({ if:String(vmid[1]), name:String(matches[1]) });
		 }   
		}		
		while (matches!=null);
		//log('finalM> '+results);
		if (results.length==0)
		  return;
		this.searchSystem.setResults(this, results);
    },

    getInitialResultSet: function (terms) {
        // GNOME 3.4 needs the results returned directly whereas 3.5.1
        // etc will ignore this and instead need pushResults() from
        // _getResultSet() above
        return this._getResultSet(null, terms);
    },

    getSubsearchResultSet: function (results, terms) {
        // GNOME 3.4 needs the results returned directly whereas 3.5.1
        // etc will ignore this and instead need pushResults() from
        // _getResultSet() above
        return this._getResultSet(results, terms);
    },
          
    createResultObject: function (metaInfo, terms) {
       let icona=this.createIcon(metaInfo.name);
       log('actor : '+icona.actor);
       return { actor: icona.actor, icon: icona };
    },
    
    filterResults: function (providerResults, maxResults) {
       return providerResults;
    },    
   
    getResultMetas: function (ids, callback) {
        let metas = ids.map(this.getResultMeta, this);
        callback(metas);
    },

    activateResult: function (id) {
        Util.spawn([ 'vboxmanage', 'startvm', id ]);
    },     
});

function init (meta) {
}

function enable () {	
    if (!provider) {
		// Dumb check if VBoxManage exists. If not I'll throw an 
		// exception to disable the extension
		try {
			Util.trySpawn(['vboxmanage']);
		} catch (err) {
			Main.notifyError("VirtualBox machines launcher : " + err.message);
			throw err;
		}
      provider = new VBoxMachinesSearchProvider();
      Main.overview.addSearchProvider(provider);
    }
}

function disable() {
    if (provider) {
        Main.overview.removeSearchProvider(provider);
        provider = null;
    }
}
