import TilemapOrthographicLayer from "./TilemapOrthographicLayer"
import Entity from "../entity/Entity"
import Resources from "../resources/Resources"
import Tileset from "../resources/Tileset"
import Tiled from "../resources/Tiled"
import Texture from "../resources/Texture"

class Tilemap extends Entity
{
	constructor(resource) {
		super()
		this.numTilesX = 0
		this.numTilesY = 0
		this.tileWidth = 0
		this.tileHeight = 0
		this.type = Tilemap.Type.Orthographic
		this.tilesets = []
		if(resource) {
			this.loadFromResource(resource)
		}
	}

	create(numTilesX, numTilesY, tileWidth, tileHeight, type = Tilemap.Type.Orthographic, name = "Layer") {
		this.name = name
		this.numTilesX = numTilesX
		this.numTilesY = numTilesY
		this.tileWidth = tileWidth
		this.tileHeight = tileHeight
		this.type = type
		this.tilesets = []
		this.size.set(numTilesX * tileWidth, numTilesY * tileHeight)
	}

	createLayer(data) {
		const layer = new TilemapOrthographicLayer()
		this.addChild(layer)
		layer.create(this.numTilesX, this.numTilesY, this.tileWidth, this.tileHeight, data)
		return layer
	}

	createTileset(config) {
		const tileset = new Tileset()
		tileset.loadFromCfg(config)
		this.tilesets.push(tileset)
	}

	loadFromResource(resource) 
	{
		let ref = null

		if(typeof resource === "string") {
			ref = Resources.get(resource)
			if(!ref) {
				console.error(`(Tilemap.loadFromResource) No such resource found: ${resource}`)
				return
			}
		}
		else {
			ref = resource
		}

		if(ref instanceof Tiled) {
			this.loadFromTiled(ref)
		}
	}

	loadFromTiled(tiled) {
		this.create(tiled.width, tiled.height, tiled.tileWidth, tiled.tileHeight, tiled.orientation, tiled.name)
		this.tilesets = tiled.tilesets
		const layers = tiled.layers
		for(let n = 0; n < layers.length; n++) {
			const layerInfo = layers[n]
			const layer = this.createLayer(layerInfo.data)
			layer.hidden = layerInfo.visible ? false : true
			layer.opacity = layerInfo.opacity
		}
	}

	getLayer(name) {
		if(!this.children) { 
			return null 
		}
		for(let n = 0; n < this.children.length; n++) {
			const child = this.children[n]
			if(child.name === name) {
				return child
			}
		}
		return null
	}

	getCellFromWorldPos(x, y) 
	{
		if(!this.children) { return null }

		const child = this.children[0]
		return child.getCellFromWorldPos(x, y)
	}
}

Tilemap.Type = {
	Orthographic: "orthographic",
	Isometric: "isometric",
	Hexagon: "hexagon"
}

Tilemap.Flag = {
	FlipHorizontally: 0x80000000,
	FlipVertically: 0x40000000,
	FlipDiagonally: 0x20000000
}

export default Tilemap