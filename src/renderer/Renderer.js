"use strict";

meta.class("meta.Renderer", 
{
	init: function() 
	{
		var view = meta.cache.view;
		this.holder = new Entity.Geometry();
		this.holder._view = view;
		this.staticHolder = new Entity.Geometry();
		this.staticHolder._view = view;
		
		var entityProto = Entity.Geometry.prototype;
		var flags = (this.holder.Flag.ENABLED | this.holder.Flag.INSTANCE_ENABLED);
		entityProto.flags = flags;
		entityProto.renderer = this;
		entityProto.parent = this.holder;

		this.holder.flags = flags;
		this.staticHolder.flags = flags;

		this.entities = [];
		this.entitiesHidden = [];
		this.entitiesRemove = [];

		if(meta.flags.culling) {
			this.culling = new meta.SparseGrid();
		}

		this.onRenderDebug = meta.createChannel(meta.Event.RENDER_DEBUG);
	},

	load: function() 
	{
		this.engine = meta.engine;

		this.camera = meta.camera;
		this.cameraVolume = this.camera.volume;
		this.cameraDefault = this.camera;
		//this.cameraUI = new meta.Camera();

		this.chn = {
			onDown: 		meta.createChannel(Entity.Event.INPUT_DOWN),
			onUp: 			meta.createChannel(Entity.Event.INPUT_UP),
			onClick: 		meta.createChannel(Entity.Event.CLICK),
			onDbClick: 		meta.createChannel(Entity.Event.DBCLICK),
			onDrag: 		meta.createChannel(Entity.Event.DRAG),
			onDragStart: 	meta.createChannel(Entity.Event.DRAG_START),
			onDragEnd: 		meta.createChannel(Entity.Event.DRAG_END),
			onHover: 		meta.createChannel(Entity.Event.HOVER),
			onHoverEnter: 	meta.createChannel(Entity.Event.HOVER_ENTER),
			onHoverExit: 	meta.createChannel(Entity.Event.HOVER_EXIT)
		};

		meta.input.onDown.add(this.onInputDown, this, meta.Priority.HIGH);
		meta.input.onUp.add(this.onInputUp, this, meta.Priority.HIGH);
		meta.input.onMove.add(this.onInputMove, this, meta.Priority.HIGH);
		meta.input.onDbClick.add(this.onInputDbClick, this, meta.Priority.HIGH);

		meta.engine.onAdapt.add(this.onAdapt, this);
		meta.camera.onResize.add(this.onCameraResize, this);
		meta.camera.onMove.add(this.onCameraMove, this);

		this.holder.resize(this.camera.volume.width, this.camera.volume.height);

		if(this.culling) {
			this.culling.calc();
		}
	},

	prevNum: 0,

	update: function(tDelta)
	{
		// Removal.	
		if(this.entitiesRemove.length > 0) {
			this._removeEntities(this.entitiesRemove);
			this.entitiesRemove.length = 0;
		}

		this._removeFromBuffer(this.entitiesUpdate, this.entitiesUpdateRemove);
		this._removeFromBuffer(this.entitiesAnim, this.entitiesAnimRemove);
		this._removeFromBuffer(this.entitiesPicking, this.entitiesPickingRemove);
		this._removeFromBuffer(this.tweens, this.tweensRemove);	

		// Updating.
		this.__updating = true;	

		var num = this.entitiesUpdate.length;
		for(var i = 0; i < num; i++) {
			this.entitiesUpdate[i].update(tDelta);
		}	

		num = this.tweens.length;
		for(i = 0; i < num; i++) {
			this.tweens[i].update(tDelta);
		}

		this.__updating = false;

		if(this.needSortDepth) {
			this.sort();
		}		
	},

	render: function(tDelta)
	{
		this.renderMain(tDelta);
		
		if(this.needRender) 
		{
			var debug = (this.meta.cache.debug || this.numDebug > 0);
			if(debug) {
				this.renderDebug();
				this.onRenderDebug.emit(this);	
			}

			this.renderStatic();
			this.needRender = false;
		}
	},

	_removeEntities: function(entities)
	{		
		this._removeStartID = Number.MAX_SAFE_INTEGER;

		this._removeEntitiesGroup(entities);

		var value;
		for(var n = this._removeStartID + 1; n < this.numEntities; n++)
		{
			value = this.entities[n];
			if(value) {
				this.entities[this._removeStartID++] = value;
			}
		}

		this.numEntities -= this._numRemove;
		this.entities.length = this.numEntities;
		this._numRemove = 0;

		this.needRender = true;
	},

	_removeEntitiesGroup: function(entities)
	{
		var entity, n;
		var numRemove = entities.length;
		
		for(var i = 0; i < numRemove; i++) 
		{
			entity = entities[i];
			if(!entity) { continue; }
			
			for(n = 0; n < this.numEntities; n++) 
			{
				if(this.entities[n] === entity) 
				{
					this.entities[n] = null;
					this._numRemove++;

					if(n < this._removeStartID) {
						this._removeStartID = n;
					}
					break;
				}
			}

			//
			entity._deactivate();

			if(entity.__updateIndex !== -1) {
				this.entitiesUpdateRemove.push(entity);
				entity.__updateIndex = -1;
			}

			if(entity.flags & entity.Flag.PICKING) {
				this.entitiesPickingRemove.push(entity);
			}

			if(entity.children) {
				this._removeEntitiesGroup(entity.children);
			}

			if(entity.flags & entity.Flag.REMOVED) {
				entity._remove();
			}	

			entity.flags &= ~entity.Flag.RENDER_REMOVE;
		}
	},

	_removeFromBuffer: function(buffer, removeBuffer)
	{
		var numRemove = removeBuffer.length;		
		if(numRemove > 0)
		{
			var num = buffer.length;
			var itemsLeft = num - numRemove;
			if(itemsLeft > 0)
			{
				var index;
				for(var n = 0; n < numRemove; n++) {
					index = buffer.indexOf(removeBuffer[n]);
					buffer.splice(index, 1);
				}
			}
			else {
				buffer.length = 0;
			}

			removeBuffer.length = 0;
		}
	},

	sort: function()
	{
		var i, j, tmp1, tmp2;
		var num = this.numEntities;
		for(i = 0; i < num; i++) 
		{
			for(j = i; j > 0; j--) 
			{
				tmp1 = this.entities[j];
				tmp2 = this.entities[j - 1];
				if(tmp1.totalZ < tmp2.totalZ) {
					this.entities[j] = tmp2;
					this.entities[j - 1] = tmp1;
				}
			}
		}

		num = this.entitiesPicking.length;
		for(i = 0; i < num; i++) 
		{
			for(j = i; j > 0; j--) 
			{
				tmp1 = this.entitiesPicking[j];
				tmp2 = this.entitiesPicking[j - 1];
				if(tmp1.totalZ < tmp2.totalZ) {
					this.entitiesPicking[j] = tmp2;
					this.entitiesPicking[j - 1] = tmp1;
				}
			}
		}	

		this.needSortDepth = false;
		this.needRender = true;			
	},

	makeEntityVisible: function(entity)
	{
		if(entity.flags & entity.Flag.RENDER) { return; }

		entity.flags |= entity.Flag.RENDER;

		if(entity.flags & entity.Flag.RENDER_REMOVE) 
		{
			var index = this.entitiesRemove.indexOf(entity);
			this.entitiesRemove[index] = null;
			entity.flags &= ~entity.Flag.RENDER_REMOVE;
		}
		else
		{
			if(entity.flags & entity.Flag.PICKING) {
				this.entitiesPicking.push(entity);
			}

			this.entities.push(entity);
			this.numEntities++;
		}

		this.needSortDepth = true;
		this.needRender = true;
	},

	makeEntityInvisible: function(entity)
	{
		if((entity.flags & entity.Flag.RENDER) === 0) { return; }

		entity.flags &= ~entity.Flag.RENDER;
		entity.flags |= entity.Flag.RENDER_REMOVE;

		this.entitiesRemove.push(entity);
	},	

	addEntity: function(entity, reuse)
	{
		if((entity.flags & entity.Flag.INSTANCE_ENABLED) === 0) { return; }

		entity._activate();

		if(this.culling) {
			this.culling.add(entity);
		}
		else {
			this.makeEntityVisible(entity);
		}

		if(entity.children) 
		{
			var children = entity.children;
			var num = children.length;
			for(var n = 0; n < num; n++) {
				this.addEntity(children[n], reuse);
			}
		}
	},

	addEntities: function(entities)
	{
		var numEntities = entities.length;
		for(var n = 0; n < numEntities; n++) {
			this.addEntity(entities[n], false);
		}
	},

	removeEntity: function(entity)
	{
		if((entity.flags & entity.Flag.ACTIVE) === 0) { return; }
		if(entity.flags & entity.Flag.RENDER_REMOVE) { return; }

		entity.flags |= entity.Flag.RENDER_REMOVE;

		this.entitiesRemove.push(entity);		
	},

	removeEntities: function(entities)
	{
		var numRemove = entities.length;
		for(var i = 0; i < numRemove; i++) {
			this.removeEntity(entities[i]);
		}
	},

	addAnim: function(anim)
	{
		if(anim.__index !== -1) { return; }

		anim.__index = this.entitiesAnim.push(anim) - 1;
	},

	removeAnim: function(anim)
	{
		if(anim.__index === -1) { return; }

		this.entitiesAnimRemove.push(anim);
		anim.__index = -1;
	},

	/** 
	 * Callback on input event.
	 * @param data {*} Event data.
	 * @param event {*} Event type.
	 */
	onInputDown: function(data, event)
	{
		if(!this.enablePicking) { return; }

		this._checkHover(data);
		if(!this.hoverEntity) { return; }

		//
		data.entity = this.hoverEntity;
		this.pressedEntity = this.hoverEntity;
		this.pressedEntity.pressed = true;

		if(this.pressedEntity.onDown) {
			this.pressedEntity.onDown.call(this.pressedEntity, data);
		}
		
		this.chn.onDown.emit(data, Entity.Event.INPUT_DOWN);
	},

	onInputUp: function(data, event)
	{
		if(!this.enablePicking) { return; }

		//
		if(this.pressedEntity) 
		{
			data.entity = this.hoverEntity;

			// INPUT UP
			this.pressedEntity.pressed = false;
			if(this.pressedEntity.onUp) {
				this.pressedEntity.onUp.call(this.pressedEntity, event);
			}
			
			this.chn.onUp.emit(this.pressedEntity, Entity.Event.INPUT_UP);	

			this._checkHover(data);

			// CLICK
			if(this.pressedEntity === this.hoverEntity) 
			{
				if(this.pressedEntity.onClick) {
					this.pressedEntity.onClick.call(this.pressedEntity, data);
				}
				
				this.chn.onClick.emit(data, Entity.Event.CLICK);
			}

			// DRAG END?
			if(this.pressedEntity.dragged) 
			{
				data.entity = this.pressedEntity;
				this.pressedEntity.dragged = false;

				if(this.pressedEntity.onDragEnd) {
					this.pressedEntity.onDragEnd.call(this.pressedEntity, data);
				}
				
				this.chn.onDragEnd.emit(data, Entity.Event.DRAG_END);
				data.entity = this.hoverEntity;				
			}					

			this.pressedEntity = null;				
		}
	},

	/** 
	 * Callback on input move event.
	 * @param data {*} Event data.
	 * @param event {*} Event type.
	 */
	onInputMove: function(data, event)
	{
		if(!this.enablePicking) { return; }

		this._checkHover(data);
		
		if(!this._checkDrag(data)) { 
			data.entity = this.hoverEntity;		
			return; 
		}

		data.entity = this.hoverEntity;
	},	

	onInputDbClick: function(data, event) 
	{
		if(!this.enablePicking) { return; }

		this._checkHover(data);

		if(this.hoverEntity) 
		{
			data.entity = this.hoverEntity;	

			if(this.hoverEntity.onDbClick) {
				this.hoverEntity.onDbClick.call(this.hoverEntity, data);
			}
			
			this.chn.onDbClick.emit(data, Entity.Event.DBCLICK);
		}
		else {
			data.entity = null;
		}
	},

	_checkHover: function(data)
	{
		var entity;
		var numEntities = this.entitiesPicking.length;
		for(var i = numEntities - 1; i >= 0; i--)
		{
			entity = this.entitiesPicking[i];
			if(entity.flags & entity.Flag.INSTANCE_HIDDEN) { continue; }

			if(this.enablePixelPicking) 
			{
				if(entity._static) 
				{
					if(!entity.isPointInsidePx(data.screenX, data.screenY)) {
						continue;
					}					
				}
				else 
				{
					if(!entity.isPointInsidePx(data.x, data.y)) {
						continue;
					}
				}
			}
			else 
			{
				if(entity._static) 
				{
					if(!entity.isPointInside(data.screenX, data.screenY)) {
						continue;
					}					
				}
				else 
				{
					if(!entity.isPointInside(data.x, data.y)) {
						continue;
					}
				}
			}

			if(this.hoverEntity !== entity)
			{
				// HOVER EXIT
				if(this.hoverEntity)
				{
					data.entity = this.hoverEntity;
					
					this.hoverEntity.hover = false;
					if(this.hoverEntity.onHoverExit) {
						this.hoverEntity.onHoverExit.call(this.hoverEntity, data);
					}

					this.chn.onHoverExit.emit(data, Entity.Event.HOVER_EXIT);
				}

				// HOVER ENTER
				data.entity = entity;
				entity.hover = true;

				if(entity.onHoverEnter) {
					entity.onHoverEnter.call(entity, data);
				}
				
				this.chn.onHoverEnter.emit(data, Entity.Event.HOVER_ENTER);
				this.hoverEntity = entity;
			}
			// HOVER
			else
			{
				data.entity = entity;

				if(entity.onHover) {
					entity.onHover.call(entity, data);
				}
				
				this.chn.onHover.emit(data, Entity.Event.HOVER);
			}

			data.entity = null;
			return;
		}

		// HOVER EXIT
		if(this.hoverEntity)
		{
			data.entity = this.hoverEntity;
			this.hoverEntity.hover = false;

			if(this.hoverEntity.onHoverExit) {
				this.hoverEntity.onHoverExit.call(this.hoverEntity, data);
			}
			
			this.chn.onHoverExit.emit(data, Entity.Event.HOVER_EXIT);
		}

		this.hoverEntity = null;
	},

	_checkDrag: function(data)
	{
		if(this.pressedEntity)
		{
			data.entity = this.pressedEntity;

			// DRAG START
			if(!this.pressedEntity.dragged) 
			{
				this.pressedEntity.dragged = true;

				if(this.pressedEntity.onDragStart) {
					this.pressedEntity.onDragStart.call(this.pressedEntity, data);
				}
				
				this.chn.onDragStart.emit(data, Entity.Event.DRAG_START);
			}
			// DRAG
			else 
			{
				if(this.pressedEntity.onDrag) {
					this.pressedEntity.onDrag.call(this.pressedEntity, data);
				}
				
				this.chn.onDrag.emit(data, Entity.Event.DRAG);				
			}

			return false;
		}

		return true;
	},	

	onCameraResize: function(data, event) 
	{
		this.holder.resize(data.width, data.height);
		this.staticHolder.resize(this.engine.width, this.engine.height);

		if(this.culling) {
			this.culling.calc();
		}
	},

	onCameraMove: function(data, event) 
	{
		if(this.culling) {
			this.culling.calc();
		}

		this.needRender = true;
	},

	onAdapt: function(data, event) {

	},	

	/**
	 * Get unique id.
	 * @return {number} Generated unique id.
	 */
	getUniqueID: function() {
		return this.__uniqueID++;
	},

	set bgColor(hex) {
		this._bgColor = hex;
		this.updateBgColor();
		this.needRender = true;
	},

	get bgColor() { return this._bgColor; },

	set transparent(value) {
		this._transparent = value;
		this.updateBgColor();
		this.needRender = true;
	},

	get transparent() { return this._transparent; },	

	addRender: function(owner) {
		this._renderFuncs.push(owner);
	},

	removeRender: function(owner) 
	{
		var length = this._renderFuncs.length;
		for(var i = 0; i < length; i++) {
			if(this._renderFuncs[i] === owner) {
				this._renderFuncs[i] = this._renderFuncs[length - 1];
				this._renderFuncs.pop();
				break;
			}
		}
	},	

	//
	onRenderDebug: null,

	//
	meta: meta,
	engine: null,
	chn: null,

	culling: null,

	holder: null,
	staticHolder: null,

	camera: null,
	cameraVolume: null,
	cameraDefault: null,
	cameraUI: null,

	_numRemove: 0,
	_removeStartID: 0,

	entities: null,
	entitiesHidden: null,
	entitiesRemove: null,
	numEntities: 0,

	entitiesUpdate: [],
	entitiesUpdateRemove: [],

	entitiesAnim: [],
	entitiesAnimRemove: [],	

	entitiesPicking: [],
	entitiesPickingRemove: [],
	hoverEntity: null,
	pressedEntity: null,
	enablePicking: true,
	enablePixelPicking: false,	

	tweens: [],
	tweensRemove: [],

	needRender: true,
	needSortDepth: false,
	useSparseGrid: false,

	_renderFuncs: [],

	currZ: 0,
	numDebug: 0,

	_bgColor: "#ddd",
	_transparent: false,	

	__uniqueID: 0,
	__updating: false
});
