attribute vec4 aPosition;

varying highp vec2 vTextureCoord;

uniform mat4 uMatrix;

void main()
{
    vTextureCoord = vec2(aPosition.x, aPosition.y);

    gl_Position = uMatrix * aPosition;
}
