import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import vertSrc from './vertex.glsl'
import fragSrc from './fragment.glsl'

const glm = require('gl-matrix');


function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}


class WebGL {
    constructor(glContext, vertexShaderSource, fragmentShaderSource, blurRadius, blurStrength) {
        this.gl = glContext;

        this.baseTexture = this.gl.createTexture();
        this.firstPassTexture = this.gl.createTexture();
        this.frameBuffer = this.gl.createFramebuffer();

        this.shaderProgram = this._createShaderProgram(vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.shaderProgram);
        this.uniformLocations = this._getUniformLocations();

        this.isImgSet = false;

        this.position = this._setBuffer();

        this.setBlurRadius(blurRadius);
        this.setBlurStrength(blurStrength);
    }

    setImage(imageUrl) {
        const image = new Image();
        image.onload = () => {
            this.gl.canvas.width = image.width;
            this.gl.canvas.height = image.height;
            this.gl.viewport(0, 0, image.width, image.height);

            this._setTexture(this.baseTexture, image, image.width, image.height);

            this._setTexture(this.firstPassTexture, null, image.width, image.height);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.firstPassTexture);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.firstPassTexture, 0);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

            const matrix = this._createMatrix(image.width, image.height);
            this.gl.uniformMatrix4fv(this.uniformLocations.uMatrix, false, matrix);

            this.gl.uniform2fv(this.uniformLocations.uResolution, [image.width, image.height]);

            this.isImgSet = true;
            this.draw();
        }

        image.src = imageUrl;
    }

    setBlurRadius(radius) {
        this.gl.uniform1f(this.uniformLocations.uRadius, radius);
    }

    setBlurStrength(strength) {
        this.gl.uniform1f(this.uniformLocations.uStrength, strength);
    }

    draw() {
        if (this.isImgSet) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.baseTexture);

            this._drawOnePass([1.0, 0.0], 0);

            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.firstPassTexture);

            this._drawOnePass([0.0, 1.0], 1);
        }
    }

    _drawOnePass(direction, flip) {
        this.gl.uniform1i(this.uniformLocations.uFlip, flip);
        this.gl.uniform2fv(this.uniformLocations.uDirection, direction);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.position);
        const position = this.gl.getAttribLocation(this.shaderProgram, "aPosition");
        this.gl.enableVertexAttribArray(position);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    _createMatrix(width, height) {
        let matrix = glm.mat4.create();
        glm.mat4.ortho(matrix, 0, width, height, 0, -1, 1);
        glm.mat4.scale(matrix, matrix, [width, height, 1]);

        return matrix;
    }

    _createShader(shaderSource, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, shaderSource);
        this.gl.compileShader(shader);

        if (this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            return shader;
        }

        console.log(this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
    }

    _createShaderProgram(vertexShaderSource, fragmentShaderSource) {
        const vertexShader = this._createShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this._createShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        if (this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            return program;
        }

        console.log(this.gl.getProgramInfoLog(program));
        this.gl.deleteProgram(program);
    }

    _setTexture(texture, image, width, height) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        if (image) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        } else {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        }

        if (isPowerOf2(width) && isPowerOf2(height)) {
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        } else {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    _setBuffer() {
        const vertices = new Float32Array([
            -1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
            1.0, 1.0, 1.0, -1.0, -1.0, 1.0,
        ]);

        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        const position = this.gl.getAttribLocation(this.shaderProgram, "aPosition");
        this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(position);

        return vertexBuffer;
    }

    _getUniformLocations() {
        const uniformNames = ['uMatrix', 'uTexture', 'uResolution', 'uDirection', 'uRadius', 'uStrength', 'uFlip'];

        let dictionary = uniformNames.reduce((map, name) => (map[name] = this.gl.getUniformLocation(this.shaderProgram, name), map), {});

        return dictionary;
    }
}

class Slider extends React.Component {
    handleChange(event) {
        this.props.onSliderChange(event.target.value);
    }

    render() {
        return (
            <div>
                <label for={this.props.label + "_slider"}>
                    {this.props.label}
                </label>
                <br />
                <input
                    id={this.props.label + "_slider"}
                    type="range"
                    min={this.props.min}
                    max={this.props.max}
                    step={this.props.step}
                    value={this.props.value}
                    onChange={(event) => this.handleChange(event)}
                />
                {this.props.value}
            </div>
        );
    }
}

class Interface extends React.Component {
    constructor(props) {
        super(props);
        this.imgInputRef = React.createRef();
    }

    triggerInputClick() {
        this.imgInputRef.current.click();
    }

    render() {
        return (
            <div className="interface">
                <h2>Интерфейс управления</h2>
                <Slider
                    label={"Радиус"}
                    onSliderChange={this.props.onRadiusChange}
                    min={0.0}
                    max={10.0}
                    step={1.0}
                    value={this.props.blurRadius}
                />
                <br />
                <Slider
                    label={"Сила размытия"}
                    onSliderChange={this.props.onStrengthChange}
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    value={this.props.blurStrength}
                />
                <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(event) => this.props.onImgLoad(event)}
                    ref={this.imgInputRef}
                />
                <button onClick={() => this.triggerInputClick()}>
                    Загрузить изображение
                </button>
                <button onClick={this.props.onImgSave}>
                    Сохранить изображение
                </button>
            </div>
        );
    }
}

class Result extends React.Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.props.onMount(this.canvasRef.current);
    }

    render() {
        return (
            <div className="result">
                <h2>Результат</h2>
                <canvas
                    style={{ border: "1px solid black" }}
                    ref={this.canvasRef}
                />
            </div>
        );
    }
}

class Gauss extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imgName: null,
            imgUrl: null,
            WebGL: null,
            canvas: null,
            blurRadius: 0.0,
            blurStrength: 0.01,
        };
    }

    handleCanvasWebGLMount = (canvas) => {
        const glContext = canvas.getContext("webgl", { preserveDrawingBuffer: true });
        this.setState({
            WebGL: new WebGL(glContext, vertSrc, fragSrc, this.state.blurRadius, this.state.blurStrength),
            canvas: canvas,
        });
    }

    handleImgLoad = (event) => {
        if (event.target.files && event.target.files[0]) {
            const img = event.target.files[0];
            this.setState({
                imgName: img.name,
                imgUrl: URL.createObjectURL(img),
            }, function () {
                this.state.WebGL.setImage(this.state.imgUrl);
            });
        }
    }

    handleImgSave = () => {
        let downloadLink = document.createElement('a');
        downloadLink.setAttribute('download', this.state.imgName);
        this.state.canvas.toBlob((blob) => {
            let url = URL.createObjectURL(blob);
            downloadLink.setAttribute('href', url);
            downloadLink.click();
        });
    }

    handleRadiusSlider = (radius) => {
        this.setState({
            blurRadius: radius,
        }, function () {
            this.state.WebGL.setBlurRadius(radius);
            this.state.WebGL.draw();
        });
    }

    handleStrengthSlider = (strength) => {
        this.setState({
            blurStrength: strength,
        }, function () {
            this.state.WebGL.setBlurStrength(strength);
            this.state.WebGL.draw();
        });
    }

    render() {
        return (
            <div className="gauss">
                <Interface
                    onImgLoad={this.handleImgLoad}
                    onImgSave={this.handleImgSave}
                    blurRadius={this.state.blurRadius}
                    blurStrength={this.state.blurStrength}
                    onRadiusChange={this.handleRadiusSlider}
                    onStrengthChange={this.handleStrengthSlider}
                />
                <Result
                    onMount={this.handleCanvasWebGLMount}
                />
            </div>
        );
    }
}

// ========================================

ReactDOM.render(
    <Gauss />,
    document.getElementById('root')
);
