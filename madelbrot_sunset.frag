// Author: Austin Spafford
// Title: Mandelbrot Sunset
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int; // Specifically needing since there are more than 2^15 seconds in a day.

uniform vec2 u_resolution;
uniform float u_time;

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

float distance_sq(
	vec2 point_one,
	vec2 point_two)
{
    vec2 delta = (point_two - point_one);
    
	return dot(delta, delta);
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

float cosine_poop(
	float domain_fraction)
{
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
    
    for (int octave_index = 0; octave_index < 5; ++octave_index)
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

float get_mandelbrot_iteration_count(
	vec2 test_point)
{
    // https://en.wikipedia.org/wiki/Mandelbrot_set
    
    float result = 0.0;
    
    vec2 orbit_point = vec2(0.0);
    for (int iteration_count = 0; iteration_count < 100; ++iteration_count)
    {
        // Reminder: The mandelbrot iteration scheme is: "z <=> z^2 + c"
        
        // Square "z", which is a complex number.
        // Reminder: It's super-trippy to modify how complex numbers are squared.
        orbit_point = 
            vec2(
            	((orbit_point.x * orbit_point.x) - (orbit_point.y * orbit_point.y)),
        		(2.0 * orbit_point.x * orbit_point.y));
        
        // Add in "c".
        orbit_point += test_point;
        
        // Has the point definitely escaped?
        if (length_sq(orbit_point) > (256.0 * 256.0)) // NOTE: This threshold is required by the simplified result-smoothing math.
        {
            break;
        }
        
        // Count this as a completed iteration.
        result += 1.0;
    }
    
    // Smooth the output by accounting for how *far* we were to the next iteration.
    // Credit: http://iquilezles.org/www/articles/mset_smooth/mset_smooth.htm
    result += (4.0 - log2(log2(length_sq(orbit_point))));
    
	return result;
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom to fit the entire fractal.
    test_point -= 0.5;
    test_point *= 2.8;
    
    float texture_aspect_ratio = (u_resolution.x / u_resolution.y);
    
    // Perform aspect-ratio correction.
	test_point.x *= max(1.0, texture_aspect_ratio);
    test_point.y *= max(1.0, (1.0 / texture_aspect_ratio));
    
    // Crop down until the artwork is touching at least one pair of edges.
    {
        float artwork_aspect_ratio = 1.2;
        
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
    
    // Center the fractal.
    test_point.x -= 0.7;
    
    // Zoom back in.
    test_point *= 0.2;
    test_point -= vec2(0.5, 0.0);
    
    test_point *= rotation_matrix(radians(1.0) * u_time);
    //test_point *= cosine_poop(0.1 * u_time);
    
    float curve_fraction = (get_mandelbrot_iteration_count(test_point) / 100.0);
    
    vec3 curve_color;
    {
    	float base_animated_curve_fraction = fract(fract(1.0 * curve_fraction) + fract(0.03 * u_time));
        
        float pulse_animated_curve_fraction = fract(fract(20.0 * curve_fraction) + fract(-0.01 * u_time));
        
        float fractal_pulse_fraction = get_layered_pulses(curve_fraction, 0.5, 0.5, 8);
        {        
        	//fractal_pulse_fraction = (smoothstep(0.3, 0.5, pulse_animated_curve_fraction) * smoothstep(0.501, 0.5, pulse_animated_curve_fraction));
        }
        
    	//curve_color = hsb_to_rgb(vec3(curve_fraction, 1.0, 1.0));
        //curve_color = hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, 1.0));
        //curve_color = mix(vec3(0.0), vec3(1.0), fractal_pulse_fraction);
        curve_color = hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, (1.0 - fractal_pulse_fraction)));
        //curve_color = hsb_to_rgb(vec3(base_animated_curve_fraction, (1.0 - fractal_pulse_fraction), 1.0));
        //curve_color = soft_add_colors(hsb_to_rgb(vec3(base_animated_curve_fraction, 1.0, 1.0)), mix(vec3(0.0), vec3(1.0), fractal_pulse_fraction));
    }
    
    float grid_fraction = 
        max(
        	smoothstep(0.02, 0.0, abs(fract(test_point.x) - 0.5)),
        	smoothstep(0.02, 0.0, abs(fract(test_point.y) - 0.5)));
        
    vec3 background_color = vec3(0.0);
    background_color += (vec3(1.2) * grid_fraction);
    
    float digit_threshold_fraction = 0.0;
        
    vec3 color = curve_color;
    //color *= mix(0.5, 1.0, smoothstep(0.015, 0.01, distance_to_curve));
    //color /= (50.0 * distance_to_curve);
    
    gl_FragColor = vec4(color, 1.0);
}

