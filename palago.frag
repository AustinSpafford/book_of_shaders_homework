// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Palago
// Many thanks for help in the hex-grid math: http://www.redblobgames.com/grids/hexagons/

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec4 u_date;

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

float get_palago_shape(
	vec3 hex_fract)
{
    vec3 half_hex_fract = (hex_fract * sign(hex_fract.x));
    
    // Accidental gear-teeth, with a balance-distance of 1.0
    //float dist_from_endpoint = (1.0 - half_hex_fract.x) + abs(half_hex_fract.y + 0.5) + abs(half_hex_fract.z + 0.5);
    
    // To easily get a proper circle, we calculate the distance in square-space.
    vec2 square_fract = convert_hex_fract_to_square_fract(half_hex_fract);
    
    float dist_from_endpoint = sqrt(pow((1.0 - square_fract.x), 2.0) + pow(square_fract.y, 2.0));
 
    float half_shape = min(
        half_hex_fract.x, 
        (dist_from_endpoint - 0.5));
    
    return (sign(hex_fract.x) * half_shape);
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
    st *= 15.0;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
    
    // st *= square_rotation(radians(10.0) * u_time);
    
    vec3 hex_coord = convert_square_coord_to_hex_coord(st);
    vec3 hex_index = get_hex_index(hex_coord);
    vec3 hex_fract = get_hex_fract(hex_coord, hex_index);
    
    float tile_seed = random(hex_index.xy + vec2(0.23472, 0.19875));
    
    const float min_rotation_speed = 0.015;
    const float max_rotation_speed = 0.02;
    
    float tile_rotation_velocity = mix(
        (-1.0 * mix(min_rotation_speed, max_rotation_speed, tile_seed)),
        mix(min_rotation_speed, max_rotation_speed, tile_seed),
        step(0.5, tile_seed));
    
    float raw_turn_count = ((u_time + 1000.0) * tile_rotation_velocity);
    
    float snapped_turn_count = floor(raw_turn_count);
    float rotation_fract = fract(raw_turn_count * sign(tile_rotation_velocity));
    
    float current_palago_shape = get_palago_shape(rotate_hex_coord(hex_fract, (snapped_turn_count * radians(120.0))));
    float next_palago_shape = get_palago_shape(rotate_hex_coord(hex_fract, ((snapped_turn_count + sign(tile_rotation_velocity)) * radians(120.0))));
    
    float mixed_palago_shape = mix(
    	current_palago_shape,
    	next_palago_shape,
    	smoothstep(0.97, 1.0, rotation_fract));
        
    vec3 color = mix(
    	vec3(1.0, 1.0, 1.0),
    	vec3(0.0, 0.25, 1.0),
    	smoothstep(-0.02, 0.02, mixed_palago_shape));
    
    // Debug-views.
    //color = (fract(hex_coord.xyz) + vec3(0.0));
    //color = (hex_index.xyz * vec3(0.25)) + vec3(0.0);
    //color = fract((hex_fract.xyz * vec3(0.5)) + vec3(0.5));
    
    //color = mix_hex_grid(color, hex_fract);
    //color = mix_hex_shading(color, hex_fract);
    
    gl_FragColor = vec4(color, 1.0);
}