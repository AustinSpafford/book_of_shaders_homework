// Author: Austin Spafford
// Title: Dark Matter

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float max_velocity = 0.1;

float random (
    vec2 st)
{
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
}

float roaming_ripple_strength(
    vec2 st,
	vec2 velocity,
	float inner_radius,
	float outer_radius)
{
    vec2 center = (u_time * velocity);
    
    vec2 cell_origin = (center - 0.5);
    
    // Stagger the rows... poorly.
    cell_origin.x += (floor(st.y - cell_origin.y) / 2.0);
    
    float dist = distance(mod((st - cell_origin), 1.0), vec2(0.5));
    
    float strength = (
    	((2.0 * smoothstep(0.0, inner_radius, dist)) - 1.0) -
    	smoothstep(inner_radius, outer_radius, dist));
    
    // Mute the strength, specifically to make it so many layers have to stack before either extreme can be reached.
    strength *= 0.5;
    
    return strength;
}

float apply_strength(
	float brightness,
	float strength)
{
    // return (brightness * (strength + 1.0));
    
    // return (brightness * ((strength + 1.0) / 2.0));
    
    return mix(
        (brightness * (strength + 1.0)), // smooth-subtraction
        (1.0 - ((1.0 - brightness) * (1.0 - strength))), // smooth-addition
        step(0.0, strength));
}

void main()
{
	vec2 st = (gl_FragCoord.xy / u_resolution.xy);
	st.x *= (u_resolution.x / u_resolution.y);
    
    // Tiling-test.
    st *= 3.0;

    float brightness = 0.5;
    
    for (int index = 0; index < 10; ++index)
    {
        vec2 velocity = vec2(
            ((2.0 * random(vec2(float(index), 0.0))) - 1.0),
            ((2.0 * random(vec2(0.0, float(index)))) - 1.0));
        
        vec2 position_offset = vec2(
            ((2.0 * random(vec2(float(index), 1.0))) - 1.0),
            ((2.0 * random(vec2(1.0, float(index)))) - 1.0));
        
        velocity *= max_velocity;
        
    	float ripple_zoom_factor = (1.0 + (0.1 * float(index)));
        
        float strength = roaming_ripple_strength(
            ((st + position_offset) * ripple_zoom_factor),
            velocity,
            0.3,
            0.45);

        brightness = apply_strength(brightness, strength);        
    }
    
    // Place focus on the highlights.
    brightness = pow(brightness, 5.0);

	gl_FragColor = vec4(vec3(brightness), 1.0);
}