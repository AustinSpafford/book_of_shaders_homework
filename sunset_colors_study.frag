// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Sunset Colors Study

precision highp float;

#define TWO_PI 6.28318530718

uniform vec2 u_resolution;
uniform float u_time;

//  Function from Iñigo Quiles 
//  https://www.shadertoy.com/view/MsS3Wc
vec3 hsb2rgb( in vec3 c ){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                             6.0)-3.0)-1.0, 
                     0.0, 
                     1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
}

void main(){
    vec2 st = gl_FragCoord.xy/u_resolution;
    vec3 color = vec3(0.0);

    // Use polar coordinates instead of cartesian
    vec2 toCenter = vec2(0.5)-st;
    float angle = atan(toCenter.y,toCenter.x);
    float radius = length(toCenter)*2.0;
  
    // Map the angle (-PI to PI) to the Hue (from 0 to 1)
    // and the Saturation to the radius
    angle = st.x*2.;
    radius = 1.;
    
    vec3 rainbow1 =  hsb2rgb(vec3((angle*1.1/TWO_PI)+0.5 + (u_time*0.03),radius,1.0));
    
    vec3 rainbow2 = hsb2rgb(vec3((angle*0.7/TWO_PI)+0.5 - (u_time*0.05),radius,1.0));

    // color = (rainbow1 * rainbow2);
    color = mix(rainbow1, rainbow2, 0.5); // "stationary changes"
    // color = mix(rainbow1, rainbow2, st.y); // "passing waves"
    // color = mix(rainbow1, rainbow2, (sin(u_time)*0.5 + 0.5)); // "ebb and flow"
    color /= length(color);

    gl_FragColor = vec4(color,1.0);
}