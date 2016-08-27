// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Hex Waves
// Many thanks for help in the hex-grid math: http://www.redblobgames.com/grids/hexagons/

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// www.wolframalpha.com/input/?i=1+%2F+sin+60
const float k_one_over_unit_hex_extant_y = 1.15470053;

float random(
    vec2 st)
{
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
}

vec3 convert_square_coord_to_hex_coord(
	vec2 square_coord)
{
    vec3 result;    
    
    result.x = 
        ((2.0 / 3.0) * square_coord.x);
    
    result.y = 
        ((-1.0 / 3.0) * square_coord.x) + 
        ((0.5 * k_one_over_unit_hex_extant_y) * square_coord.y);
    
    result.z = 
        (0.0 - (result.x + result.y));
        
    return result;
}

vec3 get_hex_index(
	vec3 hex_coord)
{
    // Start with naive-rounding.
    vec3 hex_index = floor(hex_coord + vec3(0.5));
    
    // Measure how far the rounding moved the point.
    vec3 change = abs(hex_index - hex_coord);
    
    // Near the corners of each hex the component with the biggest
    // change will be incorrect, so recompute it from the other two.
    if ((change.x > change.y) && (change.x > change.z))
    {
        hex_index.x = (0.0 - (hex_index.y + hex_index.z));
    }
    else if (change.y > change.z)
    {
        hex_index.y = (0.0 - (hex_index.x + hex_index.z));
    }
    else
    {
        hex_index.z = (0.0 - (hex_index.x + hex_index.y));
    }
    
    return hex_index;
}

vec3 get_hex_fract(
	vec3 hex_coord,
	vec3 hex_index)
{
    return ((hex_coord - hex_index) * (3.0 / 2.0));
}

vec2 convert_hex_coord_to_square_coord(
	vec3 hex_coord)
{
    return vec2(
        ((3.0 / 2.0) * hex_coord.x),
        (sqrt(3.0) * ((hex_coord.x / 2.0) + hex_coord.y)));
}

vec2 convert_hex_fract_to_square_fract(
	vec3 hex_fract)
{
    return convert_hex_coord_to_square_coord((2.0 / 3.0) * hex_fract);
}

vec3 wrap_hex_fract_into_x_tridant(
	vec3 hex_fract)
{
    if ((hex_fract.x > hex_fract.y) && (hex_fract.x > hex_fract.z))
    {
        return hex_fract;
    }
    else if (hex_fract.y > hex_fract.z)
    {
        return hex_fract.yzx;
    }
    else
    {
        return hex_fract.zxy;
    }
}

mat2 square_rotation(
	float theta)
{    
    float cosine_theta = cos(theta);
    float sine_theta = sin(theta);
    
    return mat2(
    	cosine_theta, sine_theta,
        (-1.0 * sine_theta), cosine_theta);
}

vec3 rotate_hex_coord(
    vec3 hex_coord,
	float theta)
{
    float cosine_theta = cos(theta);
    float sine_theta = sin(theta);
    
    // When the axis of rotation (1, 1, 1) is normalized, we get the following component.
    float axis_component = sqrt(1.0 / 3.0);
    
    // Reference: http://inside.mines.edu/fs_home/gmurray/ArbitraryAxisRotation/
    // Note that the hex-coord restriction of "(x + y + z) = 0" greatly simplifies things.
    vec2 result_xy = vec2(
        (hex_coord.x * cosine_theta) + (axis_component * (-hex_coord.y + hex_coord.z) * sine_theta),
    	(hex_coord.y * cosine_theta) + (axis_component * (hex_coord.x - hex_coord.z) * sine_theta));
    
    return vec3(
        result_xy.x, 
        result_xy.y,
    	(0.0 - (result_xy.x + result_xy.y)));
}

float get_hex_shape(
	vec3 hex_fract)
{
    // This was figured out somewhat by accident... it really needs a proof.
    float distance_from_center = 
        max(max(
            abs(hex_fract.x - hex_fract.y),
            abs(hex_fract.x - hex_fract.z)),
            abs(hex_fract.y - hex_fract.z));
    
    // Scale the distance to be relative to the edges, rather than relative to the vertices.
    distance_from_center *= (2.0 / 3.0);
    
    return (distance_from_center - 1.0);
}

vec3 get_hours_minutes_seconds (
    float seconds_since_midnight)
{
	return vec3(
		mod(seconds_since_midnight, 3600.0) / 3600.0,
		mod(seconds_since_midnight, 60.0) / 60.0,
		fract(seconds_since_midnight));
}

vec3 mix_hex_grid(
	vec3 base_color,
	vec3 hex_fract)
{
    vec3 color = base_color;
    
    const vec3 grid_color = vec3(0.0);
    const float thickness = 0.03; 
    
    float hex_shape = get_hex_shape(hex_fract);
    
    return mix(color, grid_color, step(-thickness, hex_shape));
}

vec3 mix_hex_shading(
	vec3 base_color,
	vec3 hex_fract)
{
    vec3 color = base_color;
    
    const vec3 background_color = vec3(0.0);
    const vec3 rounding_color = vec3(0.3);
    const float rounding_thickness = 0.5; 
    
    float hex_shape = get_hex_shape(hex_fract);
    
    color = mix(color, background_color, step(0.0, hex_shape));
    
    color -= (rounding_color * smoothstep(-rounding_thickness, 0.0, hex_shape));
    
    return color;
}

void main()
{
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    
    // Zoom-factor.
    st -= 0.5;
    st *= 5.0;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
    
    // st *= square_rotation(radians(10.0) * u_time);
    
    vec3 hex_coord = convert_square_coord_to_hex_coord(st);
    vec3 hex_index = get_hex_index(hex_coord);
    vec3 hex_fract = get_hex_fract(hex_coord, hex_index);
    
    //mixed_palago_shape = get_palago_shape(hex_fract);
      
    vec3 color = fract((hex_fract.xyz * vec3(0.5)) + vec3(0.5));
    
    // Debug-views.
    //color = (fract(hex_coord.xyz) + vec3(0.0));
    //color = (hex_index.xyz * vec3(0.25)) + vec3(0.0);
    //color = fract((hex_fract.xyz * vec3(0.5)) + vec3(0.5));
    //color = fract((wrap_hex_fract_into_x_tridant(hex_fract).xyz * vec3(0.5)) + vec3(0.5));
    
    color = mix_hex_grid(color, hex_fract);
    //color = mix_hex_shading(color, hex_fract);
    
    gl_FragColor = vec4(color, 1.0);
}