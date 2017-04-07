// Author: Austin Spafford
// Title: Circumlotus
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int;

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

float get_polygon_shape_polar(
	float test_radius,
    float test_theta,
	int polygon_degree,
    float incircle_radius)
{
    float arc_radians = (k_tau / float(polygon_degree));
        
    //test_theta -= (0.5 * arc_radians); // Place a vertex of the polygon onto (theta=0).
    
    float arc_index = floor((test_theta / arc_radians) + 0.5); // NOTE: Adding 0.5 to place the first arc perpendicular to (theta=0).
    float test_theta_within_arc = (test_theta - (arc_index * arc_radians));
    
    float test_x_within_arc = (cos(test_theta_within_arc) * test_radius);
        
    return (test_x_within_arc - incircle_radius);
}

void get_lotus_shape(
	vec2 test_point,
	out int out_polygon_degree,
	out float out_polygon_distance,
	out float out_incircle_distance,
	out float out_circumcircle_distance)
{
    float test_radius = length(test_point);
    float test_theta = atan(test_point.y, test_point.x);
    
    float incircle_radius = 1.0;
    for (int degree = 3; degree < 50; degree++)
    {
        // http://mathworld.wolfram.com/PolygonCircumscribing.html
        float circumcircle_radius = (incircle_radius / cos(k_pi / float(degree)));
        
        //circumcircle_radius *= mix(1.0, 1.02, get_trig_cycle_fraction(0.05 * u_time)); // Expand and contract.
                
        if (test_radius <= circumcircle_radius)
        {
            float polygon_theta = test_theta;
            polygon_theta += (0.15 * sin((0.15 * float(degree)) + (-1.0 * u_time))); // Wobble with outward ripples.
            
            out_polygon_degree = degree;
            out_polygon_distance = get_polygon_shape_polar(test_radius, polygon_theta, degree, incircle_radius);
            out_incircle_distance = (test_radius - incircle_radius);
            out_circumcircle_distance = (test_radius - circumcircle_radius);
            break;
        }
        
        incircle_radius = circumcircle_radius;
        //test_theta += (u_mouse.x / u_resolution.x);
    }
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom to fit the entire fractal.
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
    
	int polygon_degree;
	float polygon_distance;
	float incircle_distance;
	float circumcircle_distance;
    get_lotus_shape(
        (test_point * rotation_matrix(k_pi / 2.0)),
        polygon_degree,
        polygon_distance,
        incircle_distance,
    	circumcircle_distance);
    
    vec4 shape_color = vec4(1.0);
    if (circumcircle_distance > 0.0)
    {
        shape_color = vec4(0.0);
    }
    else if (polygon_distance > 0.0)
    {
        vec3 base_color = 
            mix(
            	vec3(0.425,0.077,0.077),
            	vec3(1.000,0.721,0.128),
        		get_trig_cycle_fraction((0.1 * u_time) + (-0.01 * float(polygon_degree))));
            
        shape_color.rgb = 
            mix(
            	vec3(0.0),
            	base_color,
        		(smoothstep(0.0, 0.1, polygon_distance) * smoothstep(0.0, -0.05, circumcircle_distance)));
    }
    else if (incircle_distance > 0.0)
    {
        vec3 base_color = 
            mix(
            	vec3(0.425,0.217,0.049),
            	vec3(0.913,0.935,0.203),
        		get_trig_cycle_fraction((0.1273 * u_time) + (0.01 * float(polygon_degree))));
        
        shape_color.rgb = 
            mix(
            	vec3(0.0),
            	base_color,
        		(smoothstep(0.0, 0.1, incircle_distance) * smoothstep(0.0, -0.05, polygon_distance)));
    }
    else
    {
        shape_color = vec4(0.0);
    }
    
    // shape_color *= smoothstep(50.0, 40.0, float(polygon_degree)); // Force the edges to fade out.
    
    /*
    {
        shape_color = 
            hsb_to_rgb(vec3(
                ((plate_theta / k_tau) + (0.1 * u_time)),
                mix(0.0, 1.0, plate_radius_fraction),
                mix(1.0, 0.0, plate_radius_fraction)));
        ;
        
    	float base_animated_curve_fraction = fract(fract(1.0 * curve_fraction) + fract(0.03 * u_time));
        
        float pulse_animated_curve_fraction = fract(fract(20.0 * curve_fraction) + fract(-0.01 * u_time));
        
        float fractal_pulse_fraction = get_layered_pulses(curve_fraction, 0.5, 0.5, 8);
        {        
        	//fractal_pulse_fraction = (smoothstep(0.3, 0.5, pulse_animated_curve_fraction) * smoothstep(0.501, 0.5, pulse_animated_curve_fraction));
        }
        
    	//shape_color = hsb_to_rgb(vec3(curve_fraction, 1.0, 1.0));
        //shape_color = hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, 1.0));
        //shape_color = mix(vec3(0.0), vec3(1.0), fractal_pulse_fraction);
        //shape_color = hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, (1.0 - fractal_pulse_fraction)));
        //shape_color = hsb_to_rgb(vec3(base_animated_curve_fraction, (1.0 - fractal_pulse_fraction), 1.0));
        //shape_color = soft_add_colors(hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, 1.0)), mix(vec3(0.0), vec3(1.0), fractal_pulse_fraction));
    }
	*/
    
    float grid_fraction = 
        max(
        	smoothstep(0.04, 0.0, abs(fract(test_point.x))),
        	smoothstep(0.04, 0.0, abs(fract(test_point.y))));
        
    vec3 background_color = vec3(0.0);
    //background_color += (vec3(0.4) * grid_fraction);
    
    float digit_threshold_fraction = 0.0;
        
    vec3 color = 
        mix(
        	background_color,
        	shape_color.rgb,
        	shape_color.a);
    
    gl_FragColor = vec4(color, 1.0);
}

