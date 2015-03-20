"use strict";

(function(scope) 
{
	if(!scope.meta) {
		scope.meta = {};
	}

	var initializing = false;
	var fnTest = /\b_super\b/;
	var holders = {};

	function ExtendHolder(name) {
		this.name = name;
		this.classes = [];
	};

	function ExtendItem(name, prop) {
		this.name = name;
		this.prop = prop;
	};

	function Extend(clsName, extend, prop) 
	{
		var prevScope = null;
		var scope = window;
		var scopeBuffer = clsName.split(".");
		var num = scopeBuffer.length - 1;
		var fullName = scopeBuffer[num];

		for(var n = 0; n < num; n++) 
		{
			prevScope = scope;
			scope = scope[scopeBuffer[n]];
			if(!scope) {
				scope = {};
				prevScope[scopeBuffer[n]] = scope;
			}
		}

		var extendHolder = holders[fullName];
		var cls = scope[fullName];
		if(cls) {
			console.error("(meta.class) Trying to redefine existing variable: " + clsName);
			return;			
		}	

		cls = function Class(a, b, c, d, e, f) 
		{
			if(!initializing) {
				if(this._init) { 
					this._init(a, b, c, d, e, f); 
				}
				if(this.init) { 
					this.init(a, b, c, d, e, f); 
				}
			}
		};		

		var proto = null;
		var extendProto = null;

		if(extend) {
			initializing = true;
			proto = new extend();
			extendProto = proto.__proto__;
			initializing = false;
		}
		else {
			initializing = true;
			proto = new cls();
			initializing = false;
		}			

		for(var key in prop)
		{
			var p = Object.getOwnPropertyDescriptor(prop, key);
			if(p.get || p.set) {
				Object.defineProperty(proto, key, p);
				continue;
			}

			if(extend)
			{
				if(typeof(prop[key]) == "function" 
					&& typeof extendProto[key] == "function" 
					&& fnTest.test(prop[key]))
				{
					proto[key] = (function(key, fn)
					{
						return function(a, b, c, d, e, f)
						{
							var tmp = this._super;
							this._super = extendProto[key];
							this._fn = fn;
							var ret = this._fn(a, b, c, d, e, f);

							this._super = tmp;

							return ret;
						};
					})(key, prop[key]);
					continue;
				}
			}

			proto[key] = prop[key];
		}

		cls.prototype = proto;
		cls.prototype.constructor = proto.init || null;
		scope[fullName] = cls;

		if(extendHolder) {
			var extendItem = null;
			var classes = extendHolder.classes;
			num = classes.length;
			for(n = 0; n < num; n++) {
				extendItem = classes[n];
				Extend(extendItem.name, cls, extendItem.prop);
			}	

			delete holders[fullName];		
		}
	};

	meta.class = function(clsName, extendName, prop) 
	{
		if(!clsName) {
			console.error("(meta.class) Invalid class name");
			return;
		}

		if(!prop) {
			prop = extendName;
			extendName = null; 
		}
		if(!prop) {
			prop = {};	
		}

		var extend = null;

		if(extendName)
		{
			var prevScope = null;
			var extendScope = window;
			var extendScopeBuffer = extendName.split(".");
			var num = extendScopeBuffer.length - 1;
			
			for(var n = 0; n < num; n++) 
			{
				prevScope = extendScope;
				extendScope = extendScope[extendScopeBuffer[n]];
				if(!extendScope) {
					extendScope = {};
					prevScope[extendScopeBuffer[n]] = extendScope;				
				}
			}	

			var name = extendScopeBuffer[num];
			extend = extendScope[name];
			if(!extend) 
			{
				var holder = holders[name];
				if(!holder) {
					holder = new ExtendHolder(extendName);
					holders[name] = holder;
				}

				holder.classes.push(new ExtendItem(clsName, prop));			
				return;
			}			
		}		

		Extend(clsName, extend, prop);
	};

	meta.classLoaded = function()
	{
		var i = 0;
		var holder = null;
		var classes = null;
		var numClasses = 0;
		var numHolders = holders.length;
		for(var n = 0; n < numHolders; n++) {
			holder = holders[n];
			console.error("Undefined class: " + holder.name);
			classes = holder.classes;
			numClasses = classes.length;
			for(i = 0; i < numClasses; i++) {
				console.error("Undefined class: " + classes[i].name);
			}
		}
	};
})(typeof window !== void(0) ? window : global);
