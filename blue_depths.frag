// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Blue Depths

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_two_pi = 6.283185;

const float k_max_velocity = 0.1;

float random(
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
    strength *= 0.25;
    
    return strength;
}

float apply_strength(
	float brightness,
	float strength)
{
    // return (brightness * (strength + 1.0));
    
    // return (brightness * ((strength + 1.0) / 2.0));
    
    return (1.0 - ((1.0 - brightness) * (1.0 - strength))); // smooth-addition (normally doesn't exceed 1.0)
}

vec2 rotate_vec2(
	vec2 point,
	float theta)
{
    return vec2(
        (point.x * cos(theta)) + (point.y * sin(theta)),
    	(point.x * (-1.0 * sin(theta))) + (point.y * cos(theta)));
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
        float plane_theta = 
            (k_two_pi * random(vec2(float(index), 0.0)));
        
        vec2 velocity = vec2(
            ((2.0 * random(vec2(float(index), 1.0))) - 1.0),
            ((2.0 * random(vec2(1.0, float(index)))) - 1.0));
        
        vec2 position_offset = vec2(
            ((2.0 * random(vec2(float(index), 2.0))) - 1.0),
            ((2.0 * random(vec2(2.0, float(index)))) - 1.0));
        
        velocity *= k_max_velocity;
        
    	float ripple_zoom_factor = (1.0 + (0.25 * float(index)));
        
        float strength = roaming_ripple_strength(
            ((rotate_vec2(st, plane_theta) + position_offset) * ripple_zoom_factor),
            velocity,
            0.25,
            0.4);

        brightness = apply_strength(brightness, strength);        
    }
    
    // Place focus on the highlights.
    brightness = pow(brightness, 5.0);
    
    // Add a bluish tint while keeping white highlights by filtering out some of the low-end on the red/green channels.
    // Also add small hot-spot highlights, by slightly clamping at the ceiling.
    float high_end_clamp = 0.9;
    vec3 color = vec3(
    	smoothstep(0.25, high_end_clamp, brightness),
        smoothstep(0.1, high_end_clamp, brightness),
        smoothstep(0.0, high_end_clamp, brightness));

	gl_FragColor = vec4(color, 1.0);
}