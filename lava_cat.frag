// Author: Austin Spafford
// Title: Lava Cat
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int;

uniform sampler2D u_texture; // https://images-na.ssl-images-amazon.com/images/I/910PPWWqFuL.png

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_pi = radians(180.0);
const float k_tau = radians(360.0);
const int k_plate_layer_count = 10;

float saturate(
	float value)
{
	return clamp(value, 0.0, 1.0);
}

float length_sq(
	vec2 vector)
{
	return dot(vector, vector);
}

float sq(
    float value)
{
    return (value * value);
}

float distance_sq(
	vec2 point_one,
	vec2 point_two)
{
    vec2 delta = (point_two - point_one);
    
	return dot(delta, delta);
}

float wrap_angle(
	float original_radians)
{
    return mod(original_radians, k_tau);
}
    
float get_linear_fraction(
	float min,
	float max,
	float value)
{
	return (min != max) ?
        ((value - min) / (max - min)) :
    	step(value, max);
}

float get_trig_cycle_fraction(
	float domain_fraction)
{
    // Smoothly moves through: (0.0, 0.0), (0.5, 1.0), (1.0, 0.0)
    return get_linear_fraction(1.0, -1.0, cos(mix(0.0, radians(360.0), domain_fraction)));
}

float get_clamped_linear_fraction(
	float min,
	float max,
	float value)
{
	return clamp(get_linear_fraction(min, max, value), 0.0, 1.0);
}

int int_mod(
    int numerator,
    int divisor)
{
    return (numerator - ((numerator / divisor) * divisor));
}

float soft_add_fractions(
	float first,
	float second)
{
    // Derived from "compliment(compliment(first) * compliment(second))", which has the
    // effect of almost naively adding two fractions when their small, but avoiding going above 1.0 when either one is large.
    return (first + second - (first * second));
}

vec3 soft_add_colors(
	vec3 first,
	vec3 second)
{
    return vec3(
        soft_add_fractions(first.r, second.r),
        soft_add_fractions(first.g, second.g),
        soft_add_fractions(first.b, second.b));
}

float random(
    vec2 st)
{
    // From: https://thebookofshaders.com/10/
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
}

vec3 hsb_to_rgb(
    vec3 hsb_color)
{
    //  From: Iñigo Quiles 
    //  https://www.shadertoy.com/view/MsS3Wc
    vec3 rgb = clamp(abs(mod((hsb_color.x * 6.0) + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = (rgb * rgb * (3.0 - (2.0 * rgb)));
    return (hsb_color.z * mix(vec3(1.0), rgb, hsb_color.y));
}

mat2 rotation_matrix(
	float theta)
{    
    float cosine_theta = cos(theta);
    float sine_theta = sin(theta);
    
    return mat2(
    	cosine_theta, sine_theta,
        (-1.0 * sine_theta), cosine_theta);
}

float get_layered_pulses(
    float test_point,
	float head_length_fraction,
	float tail_length_fraction,
	int octave_count)
{
    float result = 0.0;
    
    // Generate an initial weight that sums up to 1.0 after being divided in half for each octave. For example:
    // 1 octave: 1/1
    // 2 octave: 2/3, 1/3
    // 3 octave: 4/7, 2/7, 1/7
    float current_octave_weight = (pow(2.0, float(octave_count - 1)) / (pow(2.0, float(octave_count)) - 1.0));
    
    for (int octave_index = 0; octave_index < k_plate_layer_count; ++octave_index)
    {
        if (octave_index >= octave_count)
        {
            break;
        }
        
        float octave_frequency = pow(3.0, float(octave_index));
        float octave_movement_speed = (-0.1 * pow(1.3, float(octave_index)));
        
        float octave_test_point = fract(fract(octave_frequency * test_point) - fract(octave_movement_speed * u_time));
        
        float octave_pulse_fraction = 
            (smoothstep(0.0, tail_length_fraction, octave_test_point) * smoothstep((tail_length_fraction + head_length_fraction), tail_length_fraction, octave_test_point));
        
        result += mix(
            (octave_pulse_fraction / float(octave_count)), // Equal-weighting. Looks incredibly noisy.
            (octave_pulse_fraction * current_octave_weight), // Proper octave-weighting. Looks relatively smooth.
            0.9);
            
        current_octave_weight *= 0.5;
    }
    
    return result;
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom to fit the entire fractal.
    float zoom_scale = 16.0;
    test_point -= 0.5;
    test_point *= 16.0;
    
    float texture_aspect_ratio = (u_resolution.x / u_resolution.y);
    
    // Perform aspect-ratio correction.
	test_point.x *= max(1.0, texture_aspect_ratio);
    test_point.y *= max(1.0, (1.0 / texture_aspect_ratio));
    
    // Crop down until the artwork is touching at least one pair of edges.
    {
        float artwork_aspect_ratio = 1.0;
        
        //artwork_aspect_ratio = texture_aspect_ratio; // Zoom in until the artwork fills the frame.
        
        if ((artwork_aspect_ratio > 1.0) && (texture_aspect_ratio > 1.0))
        {
            test_point /= min(artwork_aspect_ratio, texture_aspect_ratio);
        }
        else if ((artwork_aspect_ratio < 1.0) && (texture_aspect_ratio < 1.0))
        {
            test_point *= max(artwork_aspect_ratio, texture_aspect_ratio);
        }
    }
    
    vec2 base_texture_lookup_coord = ((test_point / zoom_scale) + vec2(0.5));    
    float texture_wobble = ((3.0 * base_texture_lookup_coord.x) + (3.0 * base_texture_lookup_coord.y) + (0.1 * u_time));
    vec2 texture_lookup_coord = (
        base_texture_lookup_coord +
        (0.02 * vec2(cos((0.1 * u_time) + texture_wobble), sin((0.05 * u_time) + texture_wobble))));
    
    vec4 texture_color = texture2D(u_texture, texture_lookup_coord);
        
    float grid_fraction = 
        max(
        	smoothstep(0.04, 0.0, abs(fract(test_point.x))),
        	smoothstep(0.04, 0.0, abs(fract(test_point.y))));
        
    vec3 background_color = vec3(0.0);
    //background_color += (vec3(0.4) * grid_fraction);
    
    float digit_threshold_fraction = 0.0;
    
    
    vec4 shape_color =
        vec4(
            mix(
                vec3(0.425,0.077,0.077),
                vec3(1.000,0.721,0.128),
                get_trig_cycle_fraction(
                    (0.1 * u_time) + 
                    (-0.05 * length(test_point)) + 
                    (-1.4 * texture_color.r) + 
                    (-0.1 * test_point.y) + 
                    (0.0 * abs(0.1 * test_point.x)))),
        	1.0);
    
    vec3 color = 
        mix(
        	background_color,
        	shape_color.rgb,
        	shape_color.a);
    
    float outer_threshold = (0.2 + (0.1 * texture_color.r));
    float inner_threshold = -0.05;
    color *= smoothstep((0.0 - outer_threshold), (0.0 - inner_threshold), texture_lookup_coord.x);
    color *= smoothstep((1.0 + outer_threshold), (1.0 + inner_threshold), texture_lookup_coord.x);
    color *= smoothstep((0.0 - outer_threshold), (0.0 - inner_threshold), texture_lookup_coord.y);
    color *= smoothstep((1.0 + outer_threshold), (1.0 + inner_threshold), texture_lookup_coord.y);
    
    gl_FragColor = vec4(color, 1.0);
}

