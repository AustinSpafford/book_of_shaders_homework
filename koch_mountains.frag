// Author: Austin Spafford
// Title: Mental Fjord
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

void get_closest_point_on_line_segment(
	vec2 line_segment_start,
	vec2 line_segment_end,
	vec2 test_point,
	out float out_closest_point_fraction,
	out float out_distance_sq)
{
    float line_segment_length = length(line_segment_end - line_segment_start);
    vec2 line_segment_direction = ((line_segment_end - line_segment_start) / line_segment_length);
    
    float distance_along_ray_to_closest_point = dot(line_segment_direction, (test_point - line_segment_start));
    
    out_closest_point_fraction = saturate(distance_along_ray_to_closest_point / line_segment_length);
    
    out_distance_sq = 
        distance_sq(
        	test_point,
        	mix(line_segment_start, line_segment_end, out_closest_point_fraction));
}

void upgrade_to_closest_line_segment(
	vec2 candidate_line_segment_start,
	vec2 candidate_line_segment_end,
    vec2 candidate_gosper_fraction_range,
	vec2 test_point,
	inout vec2 inout_closest_line_segment_start,
	inout vec2 inout_closest_line_segment_end,
    inout vec2 inout_closest_gosper_fraction_range,
    inout float inout_closest_point_fraction,
	inout float inout_closest_distance_sq)
{   
    float candidate_closest_point_fraction;
    float candidate_distance_sq;
    get_closest_point_on_line_segment(
        candidate_line_segment_start,
        candidate_line_segment_end,
        test_point,
        candidate_closest_point_fraction,
        candidate_distance_sq);
    
    if (candidate_distance_sq < inout_closest_distance_sq)
    {
        inout_closest_line_segment_start = candidate_line_segment_start;
        inout_closest_line_segment_end = candidate_line_segment_end;
        inout_closest_gosper_fraction_range = candidate_gosper_fraction_range;
        inout_closest_point_fraction = candidate_closest_point_fraction;
        inout_closest_distance_sq = candidate_distance_sq;
    }
}

float get_gosper_fraction(
	vec2 test_point,
	out float out_debug_distance_to_curve)
{
    // Reference image for the gosper-curve: http://www.fractalcurves.com/images/7T_Gosper.jpg
        
    float k_cos_60 = cos(radians(60.0));
    float k_sin_60 = sin(radians(60.0));
    
    vec2 result_fraction_range = vec2(0.0, 1.0);
    float result_line_segment_fraction;

    float total_zoom_scale = 1.0;    
    float last_iteration_zoom_scale = 1.0;

    for (int iteration_index = 0; iteration_index < 2; ++iteration_index)
    {
        total_zoom_scale *= last_iteration_zoom_scale;
        
        vec2 closest_line_segment_start;
        vec2 closest_line_segment_end;
        vec2 closest_gosper_fraction_range;
        float closest_point_fraction;
        float closest_distance_sq = 100000.0;

        upgrade_to_closest_line_segment(
            vec2(0.0, 0.0),
            vec2(1.0, 0.0),
            vec2((0.0 / 7.0), (1.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range, 
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((1.0 + k_cos_60), (0.0 + k_sin_60)),
            vec2(1.0, 0.0),
            vec2((2.0 / 7.0), (1.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((0.0 + k_cos_60), (0.0 + k_sin_60)),
            vec2((1.0 + k_cos_60), (0.0 + k_sin_60)), 
            vec2((3.0 / 7.0), (2.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((0.0 + k_cos_60), (0.0 + k_sin_60)),
            vec2((0.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((3.0 / 7.0), (4.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((0.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((1.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((4.0 / 7.0), (5.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((1.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((2.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((5.0 / 7.0), (6.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2((2.0 + k_cos_60), (0.0 + k_sin_60)), 
            vec2((2.0), (0.0 + (2.0 * k_sin_60))), 
            vec2((7.0 / 7.0), (6.0 / 7.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range,
            closest_point_fraction, 
            closest_distance_sq);
        
        vec2 original_space_start = vec2(0.0, 0.0);
        vec2 original_space_end = vec2((2.0 + k_cos_60), (0.0 + k_sin_60));
        
        last_iteration_zoom_scale = (
            distance(original_space_start, original_space_end) /
            distance(closest_line_segment_start, closest_line_segment_end));

        result_fraction_range = vec2(
            mix(result_fraction_range.x, result_fraction_range.y, closest_gosper_fraction_range.x),
            mix(result_fraction_range.x, result_fraction_range.y, closest_gosper_fraction_range.y));
        
        result_line_segment_fraction = closest_point_fraction;
        
    	out_debug_distance_to_curve = (sqrt(closest_distance_sq) / total_zoom_scale);
        
        // Transform to the next iteration's space.
        {
            test_point -= closest_line_segment_start;
            
            vec2 original_delta = (original_space_end - original_space_start);
            float original_angle = atan(original_delta.y, original_delta.x);
            vec2 next_segment_delta = (closest_line_segment_end - closest_line_segment_start);
            float next_segment_angle = atan(next_segment_delta.y, next_segment_delta.x);            
            test_point *= rotation_matrix(next_segment_angle - original_angle);
            
            test_point *= last_iteration_zoom_scale;
            
            test_point += original_space_start;
        }
    }
    
    return mix(result_fraction_range.x, result_fraction_range.y, result_line_segment_fraction);
}

float get_koch_fraction(
	vec2 test_point,
	out float out_debug_distance_to_curve)
{
    // Reference image for the gosper-curve: http://www.fractalcurves.com/images/7T_Gosper.jpg
        
    float k_cos_60 = cos(radians(60.0));
    float k_sin_60 = sin(radians(60.0));
    
    vec2 result_fraction_range = vec2(0.0, 1.0);
    float result_line_segment_fraction;

    float total_zoom_scale = 1.0;    
    float last_iteration_zoom_scale = 1.0;

    for (int iteration_index = 0; iteration_index < 7; ++iteration_index)
    {
        total_zoom_scale *= last_iteration_zoom_scale;
        
        vec2 closest_line_segment_start;
        vec2 closest_line_segment_end;
        vec2 closest_gosper_fraction_range;
        float closest_point_fraction;
        float closest_distance_sq = 100000.0;

        upgrade_to_closest_line_segment(
            vec2(0.0, 0.0),
            vec2(0.3333, 0.0),
            vec2((0.0 / 4.0), (1.0 / 4.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range, 
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2(0.3333, 0.0),
            vec2(0.5, (0.3333 * k_sin_60)),
            vec2((1.0 / 4.0), (2.0 / 4.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range, 
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2(0.5, (0.3333 * k_sin_60)),
            vec2(0.66666, 0.0),
            vec2((2.0 / 4.0), (3.0 / 4.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range, 
            closest_point_fraction, 
            closest_distance_sq);

        upgrade_to_closest_line_segment(
            vec2(0.66666, 0.0),
            vec2(1.0, 0.0),
            vec2((3.0 / 4.0), (4.0 / 4.0)),
            test_point,
            closest_line_segment_start, 
            closest_line_segment_end, 
            closest_gosper_fraction_range, 
            closest_point_fraction, 
            closest_distance_sq);
        
        vec2 original_space_start = vec2(0.0, 0.0);
        vec2 original_space_end = vec2(1.0, 0.0);
        
        last_iteration_zoom_scale = (
            distance(original_space_start, original_space_end) /
            distance(closest_line_segment_start, closest_line_segment_end));

        result_fraction_range = vec2(
            mix(result_fraction_range.x, result_fraction_range.y, closest_gosper_fraction_range.x),
            mix(result_fraction_range.x, result_fraction_range.y, closest_gosper_fraction_range.y));
        
        result_line_segment_fraction = closest_point_fraction;
        
    	out_debug_distance_to_curve = (sqrt(closest_distance_sq) / total_zoom_scale);
        
        // Transform to the next iteration's space.
        {
            test_point -= closest_line_segment_start;
            
            vec2 original_delta = (original_space_end - original_space_start);
            float original_angle = atan(original_delta.y, original_delta.x);
            vec2 next_segment_delta = (closest_line_segment_end - closest_line_segment_start);
            float next_segment_angle = atan(next_segment_delta.y, next_segment_delta.x);            
            test_point *= rotation_matrix(next_segment_angle - original_angle);
            
            test_point *= last_iteration_zoom_scale;
            
            test_point += original_space_start;
        }
    }
    
    return mix(result_fraction_range.x, result_fraction_range.y, result_line_segment_fraction);
}

float get_hilbert_fraction(
	vec2 test_point)
{
    // NOTE: This function orients the curve with the open-side facing downwards, like this: https://upload.wikimedia.org/wikipedia/commons/a/a5/Hilbert_curve.svg
    
    float result = 0.0;
    
    if ((-0.5 <= test_point.x) && (test_point.x <= 0.5) &&
        (-0.5 <= test_point.y) && (test_point.y <= 0.5))
    {
        vec2 result_fraction_range = vec2(0.0, 1.0);
        
        float half_iteration_radius = 0.25;
        
        for (int iteration_index = 0; iteration_index < 8; ++iteration_index)
        {
            vec2 quadrant_local_fraction_range;
            
            if (test_point.x >= 0.0)
            {
                if (test_point.y >= 0.0)
                {
                    // Upper-right.
                    test_point += (vec2(-1.0, -1.0) * half_iteration_radius);
                    quadrant_local_fraction_range = vec2(0.5, 0.75);
                }
                else
                {
                    // Lower-right.
                    test_point += (vec2(-1.0, 1.0) * half_iteration_radius);
                    test_point = vec2((-1.0 * test_point.y), test_point.x); // Rotate counter-clockwise.
                    test_point.y *= -1.0; // Vertically mirror.
                    quadrant_local_fraction_range = vec2(0.75, 1.0);
                }
            }
            else
            {
                if (test_point.y >= 0.0)
                {
                    // Upper-left. Just translate to the origin.
                    test_point += (vec2(1.0, -1.0) * half_iteration_radius);
                    quadrant_local_fraction_range = vec2(0.25, 0.5);
                }
                else
                {
                    // Lower-left. Rotate clockwise and then vertically mirror.
                    test_point += (vec2(1.0, 1.0) * half_iteration_radius);
                    test_point = vec2(test_point.y, (-1.0 * test_point.x)); // Rotate clockwise.
                    test_point.y *= -1.0; // Vertically mirror.
                    quadrant_local_fraction_range = vec2(0.0, 0.25);
                }
            }
            
            result_fraction_range = vec2(
                mix(result_fraction_range.x, result_fraction_range.y, quadrant_local_fraction_range.x),
                mix(result_fraction_range.x, result_fraction_range.y, quadrant_local_fraction_range.y));
            
            half_iteration_radius *= 0.5;
        }
    
        result = mix(result_fraction_range.x, result_fraction_range.y, 0.5);
    }
    
    return result;
}

float get_moore_fraction(
	vec2 test_point)
{
    // NOTE: This function orients the curve with the open-side facing downwards, like this: https://upload.wikimedia.org/wikipedia/commons/a/a5/Hilbert_curve.svg
    
    float result = 0.0;
    
    if ((-0.5 <= test_point.x) && (test_point.x <= 0.5) &&
        (-0.5 <= test_point.y) && (test_point.y <= 0.5))
    {        
        float half_iteration_radius = 0.25;
        
        float sector_fraction_start;

        if (test_point.x >= 0.0)
        {
            if (test_point.y >= 0.0)
            {
                // Upper-right.
                test_point += vec2(-0.25, -0.25);
                test_point = vec2((-1.0 * test_point.y), test_point.x); // Rotate the displayed result clockwise.
                sector_fraction_start = 0.5;
            }
            else
            {
                // Lower-right.
                test_point += vec2(-0.25, 0.25);
                test_point = vec2((-1.0 * test_point.y), test_point.x); // Rotate the displayed result clockwise.
                sector_fraction_start = 0.75;
            }
        }
        else
        {
            if (test_point.y >= 0.0)
            {
                // Upper-left.
                test_point += vec2(0.25, -0.25);
                test_point = vec2(test_point.y, (-1.0 * test_point.x)); // Rotate the displayed result counter-clockwise.
                sector_fraction_start = 0.25;
            }
            else
            {
                // Lower-left.
                test_point += vec2(0.25, 0.25);
                test_point = vec2(test_point.y, (-1.0 * test_point.x)); // Rotate the displayed result counter-clockwise.
                sector_fraction_start = 0.0;
            }
        }
        
        result = (sector_fraction_start + (get_hilbert_fraction(2.0 * test_point) / 4.0));
    }
    
    return result;
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
    
    for (int octave_index = 0; octave_index < 8; ++octave_index)
    {
        if (octave_index >= octave_count)
        {
            break;
        }
        
        float octave_frequency = pow(3.0, float(octave_index));
        float octave_movement_speed = (0.01 * pow(1.3, float(octave_index)));
        
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
    
    // Zoom-factor.
    //test_point -= 0.2;
    test_point.y -= 0.1;
    test_point *= 1.0;
    
    float texture_aspect_ratio = (u_resolution.x / u_resolution.y);
    
    // Perform aspect-ratio correction.
	test_point.x *= max(1.0, texture_aspect_ratio);
    test_point.y *= max(1.0, (1.0 / texture_aspect_ratio));
    
    // Crop down until the artwork is touching at least one pair of edges.
    if (true) // HACK!
    {
        float artwork_aspect_ratio = 2.0;
        
        artwork_aspect_ratio = texture_aspect_ratio; // Zoom in until the artwork fills the frame.
        
        if ((artwork_aspect_ratio > 1.0) && (texture_aspect_ratio > 1.0))
        {
            test_point /= min(artwork_aspect_ratio, texture_aspect_ratio);
        }
        else if ((artwork_aspect_ratio < 1.0) && (texture_aspect_ratio < 1.0))
        {
            test_point *= max(artwork_aspect_ratio, texture_aspect_ratio);
        }
    }
        
    //test_point = (fract(test_point + vec2(0.5)) - vec2(0.5)); // Tile infinitely.
    
    //test_point *= rotation_matrix(radians(1.0) * u_time);
    
    //float curve_fraction = get_curve_fraction(test_point);
    float distance_to_curve;
    //float curve_fraction = get_gosper_fraction(test_point, distance_to_curve);
    float curve_fraction = get_koch_fraction(test_point, distance_to_curve);    
    
    vec3 curve_color;
    
    //if (curve_fraction > 0.0)
    if (true) // HACK!
    {
    	float base_animated_curve_fraction = fract(fract(1.0 * curve_fraction) + fract(0.03 * u_time));
        
        float pulse_animated_curve_fraction = fract(fract(20.0 * curve_fraction) + fract(-0.01 * u_time));
        
        float fractal_pulse_fraction = get_layered_pulses(curve_fraction, 0.01, 0.5, 8);
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
    else
	{
        curve_color = vec3(0.0);
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
    color /= (50.0 * distance_to_curve);
    
    gl_FragColor = vec4(color, 1.0);
}

