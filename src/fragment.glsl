precision mediump float;

varying highp vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;

uniform float uRadius;
uniform float uStrength;
uniform int uFlip;


float TWO_PI = 6.28319;

float gaussian(float x, float sigma)
{
    return exp(-(x * x) / (2.0 * sigma)) / sqrt(TWO_PI * sigma);
}

vec3 blur9(sampler2D texture, vec2 uv, vec2 resolution, vec2 direction)
{
    vec4 color = vec4(0.0);
    vec2 offset = vec2(uRadius, uRadius) * direction / resolution;

    for (int i = 1; i < 32; ++i) {

        float weight = gaussian( float(i) / 32.0, uStrength * 0.5);
        if ( weight < 1.0/255.0)
            break;

        vec4 c1 = texture2D(texture, uv - float(i) * offset);
        vec4 c2 = texture2D(texture, uv + float(i) * offset);

        color += vec4((c1 + c2).rgb, 2.0) * weight;
    }

    return color.rgb / color.w;
}

void main()
{
    vec2 uv = vTextureCoord;
    if (uFlip == 1) {
        uv.y = 1.0 - uv.y;
    }

    gl_FragColor = vec4(blur9(uTexture, uv, uResolution, uDirection), 1.0);
}
