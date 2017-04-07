// Author: Austin Spafford
// Title: Ctenoid
// <dummy-comment to keep the title-scraper from reading into code>
// Auto-bloom: http://player.thebookofshaders.com/?log=170318073338
// Mouse-controlled parameters: http://player.thebookofshaders.com/?log=170318080027

precision highp float;
precision highp int;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

const float k_pi = radians(180.0);
const float k_tau = radians(360.0);
const int k_plate_layer_count = 20;

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
    return get_linear_fraction(1.0, -1.0, cos(mix(0.0, k_tau, domain_fraction)));
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

bool try_get_plating_point(
	vec2 test_point,
	float scaling_per_layer,
	out int out_layer_index,
	out float out_plate_radius_fraction,
	out float out_plate_theta)
{
	bool result = false;
    
    vec2 plate_center = vec2(0.0);
    float plate_radius = 1.0;
    float plate_rotation_radians = 0.0;
    for (int layer_index = 0; layer_index < k_plate_layer_count; layer_index++)
    {
        vec2 plate_to_test_point_delta = (test_point - plate_center);
        float radius_sq = length_sq(plate_to_test_point_delta);
        float plate_to_point_theta = wrap_angle(atan(plate_to_test_point_delta.y, plate_to_test_point_delta.x) - plate_rotation_radians);
        
        if ((layer_index >= int(floor(10.0 * (1.0 - (u_mouse.x / u_resolution.x))))) &&
            (radius_sq <= sq(plate_radius)))
        {
			out_layer_index = layer_index;
            out_plate_radius_fraction = sqrt(radius_sq); // (sqrt(radius_sq) / plate_radius);
            out_plate_theta = plate_to_point_theta;
            result = true;
            break;
        }
        
        float local_child_radians;
        if (plate_to_point_theta < ((2.0 / 6.0) * k_tau))
        {
            local_child_radians = ((1.0 / 6.0) * k_tau);
        }
        else if (plate_to_point_theta < ((4.0 / 6.0) * k_tau))
        {
            local_child_radians = ((3.0 / 6.0) * k_tau);
        }
        else
        {
            local_child_radians = ((5.0 / 6.0) * k_tau);
        }
        
        // Move down to the next layer.
        {
            float world_child_radians = wrap_angle(local_child_radians + plate_rotation_radians);
            plate_center += (vec2(cos(world_child_radians), sin(world_child_radians)) * plate_radius);
            plate_radius *= scaling_per_layer;
            plate_rotation_radians += ((k_tau / 6.0) + (0.0 * u_time));
        }
    }
    
    return result;
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom to fit the entire fractal.
    test_point -= 0.5;
    test_point *= 10.0;
    
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
    
    test_point *= rotation_matrix(radians(5.0) * u_time);
    
    float scaling_per_layer = 1.0;
    //scaling_per_layer *= mix(0.8, 3.0, get_trig_cycle_fraction(0.05 * u_time));
    scaling_per_layer *= mix(0.2, 1.8, (u_mouse.y / u_resolution.y));
    
    int plating_layer_index;
    float plate_radius_fraction;
    float plate_theta;
    bool plating_hit = 
        try_get_plating_point(
        	test_point,
        	scaling_per_layer,
    		plating_layer_index,
    		plate_radius_fraction,
    		plate_theta);
    
    vec3 shape_color = vec3(0.0);
    if (plating_hit)
    {
        float test_point_fractional_theta = (atan(test_point.y, test_point.x) / k_tau);
        
        float hue = 0.0;
        hue += (0.1 * u_time);
        hue += (0.6 * float(plating_layer_index));
        //hue += ((plate_theta / k_tau) + (0.1 * u_time));
        hue += (0.1 * plate_radius_fraction);
        hue += test_point_fractional_theta;
        hue += (0.2 * get_layered_pulses(test_point_fractional_theta, 0.5, 0.5, 3));
        
        float saturation = 0.0;
        saturation += mix(0.0, 1.0, plate_radius_fraction);
        
        float brightness = 0.0;
        brightness += mix(1.0, 0.5, plate_radius_fraction);
        
        shape_color = hsb_to_rgb(vec3(hue, saturation, brightness));
    }
    
    float grid_fraction = 
        max(
        	smoothstep(0.04, 0.0, abs(fract(test_point.x))),
        	smoothstep(0.04, 0.0, abs(fract(test_point.y))));
        
    vec3 background_color = vec3(0.0);
    //background_color += (vec3(0.4) * grid_fraction);
    
    float digit_threshold_fraction = 0.0;
        
    vec3 color = (
        shape_color + 
        (plating_hit ? vec3(0.0) : background_color));
    
    gl_FragColor = vec4(color, 1.0);
}

