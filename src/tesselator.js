/**
 * @module tesselator
 */
import {GluTesselator, gluEnum, windingRule, primitiveType} from 'libtess';
import {is_ccw, is_cw, normal, area} from './polygon';

export const {
  GL_LINE_LOOP,
  GL_TRIANGLES,
  GL_TRIANGLE_STRIP,
  GL_TRIANGLE_FAN
} = primitiveType;

export const {
  GLU_TESS_WINDING_ODD,
  GLU_TESS_WINDING_NONZERO,
  GLU_TESS_WINDING_POSITIVE,
  GLU_TESS_WINDING_NEGATIVE,
  GLU_TESS_WINDING_ABS_GEQ_TWO
} = windingRule;

/**
 * Tesselator options.
 * @typedef {Object} TesselatorOptions
 * @property {Array} [polygons=[]] Array of polygons
 * @property {Array} [holes=[]] Array of holes
 * @property {Number} [vertexSize=2] Vertex size to use
 * @property {Number} [windingRule=GLU_TESS_WINDING_POSITIVE] Winding rule
 * @property {Boolean} [boundaryOnly=false] Whether to output boundaries only
 * @property {Array} [normal=null] Normal
 * @property {Boolean} [autoWinding=true] Whether to automatically set the correct winding on polygons
 */
export const DEFAULT_OPTIONS = {
  polygons: [],
  holes: [],
  windingRule: GLU_TESS_WINDING_POSITIVE,
  boundaryOnly: false,
  normal: null,
  autoWinding: true
};

export class Tesselator extends GluTesselator {

  constructor (vsize=2) {
    super();

    this._vsize = vsize;
    this._current = [];
    this._out = [];
    this._primitiveType = 0;

    this.gluTessCallback(gluEnum.GLU_TESS_VERTEX_DATA, this._vertex);
    this.gluTessCallback(gluEnum.GLU_TESS_BEGIN, this._begin);
    this.gluTessCallback(gluEnum.GLU_TESS_END, this._end);
    this.gluTessCallback(gluEnum.GLU_TESS_ERROR, this._error);
    this.gluTessCallback(gluEnum.GLU_TESS_COMBINE, this._combine);
    this.gluTessCallback(gluEnum.GLU_TESS_EDGE_FLAG, this._edge);
  }

  start (polygons, holes) {
    this._current = [];
    this._out = [];

    this.gluTessBeginPolygon();

    for (let poly of polygons) {
      this.gluTessBeginContour();
      for (let v of poly) {
        this.gluTessVertex(v, v);
      }
      this.gluTessEndContour();
    }

    for (let poly of holes) {
      this.gluTessBeginContour();
      for (let v of poly) {
        this.gluTessVertex(v, v);
      }
      this.gluTessEndContour();
    }

    this.gluTessEndPolygon();
  }

  run (options=DEFAULT_OPTIONS) {
    let opts = Object.assign({}, DEFAULT_OPTIONS, options),
        {polygons, holes, autoWinding, boundaryOnly} = opts;

    if (!polygons || !polygons.length) {
      throw new Error('need at least a single polygon');
    }

    if (autoWinding) {
      polygons = polygons.filter(p => {
        return Math.abs(area(p)) > 0;
      }).map(p => {
        if (is_cw(p)) p.reverse();
        return p;
      });
      holes = holes.filter(p => {
        return Math.abs(area(p)) > 0;
      }).map(p => {
        if (is_ccw(p)) p.reverse();
        return p;
      });
    }

    let [nx, ny, nz] = opts.normal ? opts.normal : normal(polygons[0], true);

    this.gluTessNormal(nx, ny, nz);
    this.gluTessProperty(gluEnum.GLU_TESS_BOUNDARY_ONLY, boundaryOnly);
    this.gluTessProperty(gluEnum.GLU_TESS_WINDING_RULE, opts.windingRule);

    this.start(polygons, holes);

    return this._out;
  }

  _begin (type) {
    this._primitiveType = type;
    this._current = [];
  }

  _end_fan () {
    let c = this._current.shift(),
        p1 = this._current.shift();
    while (this._current.length) {
      let p2 = this._current.shift();
      this._out.push(c, p1, p2);
      p1 = p2;
    }
  }

  _end_strip () {
    let p1 = this._current.shift(),
        p2 = this._current.shift();
    while (this._current.length) {
      let p3 = this._current.shift();
      this._out.push(p1, p2, p3);
      p1 = p2;
      p2 = p3;
    }
  }

  _end () {
    switch (this._primitiveType) {
      case GL_TRIANGLE_FAN:
        this._end_fan();
        break;
      case GL_TRIANGLE_STRIP:
        this._end_strip();
        break;
      case GL_TRIANGLES:
      case GL_LINE_LOOP:
      default:
        this._out.push(this._current);
        break;
    }
  }
  _vertex (v) {
    this._current.push(v);
  }
  _edge () {}
  _error (errno) { console.error('error number: ' + errno); }
  _combine (v, data, w) {
    for (let i = 0; i < 4; ++i) {
      if (!data[i]) {
        data[i] = new Array(this._vsize);
        for (let j = 0; j < this._vsize; ++j) {
          data[i][j] = 0;
        }
      }
    }
    let r = new Array(this._vsize);
    for (let i = 0; i < this._vsize; ++i) {
      r[i] = data[0][i] * w[0] + data[1][i] * w[1] + data[2][i] * w[2] + data[3][i] * w[3];
    }
    return r;
  }
}

/**
 * Helper for triangulate
 * @private
 */
function to_triangles (data) {
  let result = [];
  for (let i = 0; i < data.length; i += 3) {
    result.push([data[i], data[i+1], data[i+2]]);
  }
  return result;
}

/**
 * Runs the tesselator
 * @see http://www.glprogramming.com/red/chapter11.html
 *
 * @param {TesselatorOptions} [options=TesselatorOptions] Options
 *
 * @returns {Array}
 */
export function run (options=DEFAULT_OPTIONS) {
  let tesselator = new Tesselator(options.vertexSize),
      result = tesselator.run(options);
  return options.boundaryOnly ? result : result.map(to_triangles);
}
