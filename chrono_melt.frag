// Author: Austin Spafford
// Title: Chrono-Melt
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_date;

float saturate(
	float value)
{
	return clamp(value, 0.0, 1.0);
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

float random (
    vec2 st)
{
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
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

vec3 get_hours_minutes_seconds(
    float seconds_since_midnight)
{
	return vec3(
		mod(seconds_since_midnight, 3600.0) / 3600.0,
		mod(seconds_since_midnight, 60.0) / 60.0,
		fract(seconds_since_midnight));
}

vec2 get_closest_point_on_line_segment(
	vec2 line_segment_start,
	vec2 line_segment_end,
	vec2 test_point)
{
    float line_segment_length = length(line_segment_end - line_segment_start);
    vec2 line_segment_direction = ((line_segment_end - line_segment_start) / line_segment_length);
    
    float distance_along_ray_to_closest_point = dot(line_segment_direction, (test_point - line_segment_start));
    
    float closest_point_fraction = saturate(distance_along_ray_to_closest_point / line_segment_length);
        
    vec2 closest_point = 
        mix(
    		line_segment_start,
    		line_segment_end,
    		closest_point_fraction);
    
    return closest_point;
}

void convert_closest_point_to_distance_and_normal(
	vec2 closest_point,
	vec2 test_point,
	out float out_test_distance,
	out vec2 out_normal)
{
	out_test_distance = distance(closest_point, test_point);
	out_normal = normalize(test_point - closest_point);
}

void upgrade_to_smallest_distance_and_matching_normal(
    vec2 candidate_closest_point,
    vec2 test_point,
    inout float inout_smallest_distance,
    inout vec2 inout_matching_normal)
{
    float candidate_distance;
    vec2 candidate_normal;
	convert_closest_point_to_distance_and_normal(
    	candidate_closest_point,
    	test_point,
    	candidate_distance,
    	candidate_normal);
    
    if (candidate_distance < inout_smallest_distance)
    {
        inout_smallest_distance = candidate_distance;
        inout_matching_normal = candidate_normal;
    }
}

void get_distance_and_normal_to_digit_1(
	vec2 test_point,
	out float out_distance,
	out vec2 out_normal)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float bottom_bracket_size_x = 0.3;
    vec2 top_beak_size = vec2(0.15, 0.15);
    
    vec2 top_point = vec2(0.0, top_y);
    vec2 bottom_point = vec2(0.0, bottom_y);
    
    float result_distance;
    vec2 result_normal;
        
    // Stem.
    convert_closest_point_to_distance_and_normal(
    	get_closest_point_on_line_segment(
        	top_point,
        	bottom_point,
        	test_point),
        test_point,
        result_distance,
        result_normal);
    
    // Beak.
    upgrade_to_smallest_distance_and_matching_normal(    	
    	get_closest_point_on_line_segment(
            top_point,
        	(top_point - top_beak_size),
        	test_point),
    	test_point,
    	result_distance,
    	result_normal);
    
    // Foot.
    upgrade_to_smallest_distance_and_matching_normal(    	
    	get_closest_point_on_line_segment(
            (bottom_point - vec2((bottom_bracket_size_x / 2.0), 0.0)),
        	(bottom_point + vec2((bottom_bracket_size_x / 2.0), 0.0)),
        	test_point),
    	test_point,
    	result_distance,
    	result_normal);    
    
    out_distance = result_distance;
    out_normal = result_normal;
}

void get_distance_and_normal_to_digit_7(
	vec2 test_point,
	out float out_distance,
	out vec2 out_normal)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float top_arm_size_x = 0.6;    
    vec2 top_beak_size = vec2(0.0, 0.05);
    
    float bottom_foot_x = -0.1;
    
    vec2 top_left_point = vec2((-1.0 * (top_arm_size_x / 2.0)), top_y);
    vec2 top_right_point = vec2((top_arm_size_x / 2.0), top_y);
    vec2 bottom_point = vec2(bottom_foot_x, bottom_y);
    
    float result_distance;
    vec2 result_normal;
    
    // Stem.
    convert_closest_point_to_distance_and_normal(
    	get_closest_point_on_line_segment(
        	bottom_point,
        	top_right_point,
        	test_point),
        test_point,
        result_distance,
        result_normal);
    
    // Top-edge.
    upgrade_to_smallest_distance_and_matching_normal(    	
    	get_closest_point_on_line_segment(
            top_right_point,
        	top_left_point,
        	test_point),
    	test_point,
    	result_distance,
    	result_normal);
    
    // Beak.
    upgrade_to_smallest_distance_and_matching_normal(    	
    	get_closest_point_on_line_segment(
            top_left_point,
        	(top_left_point - top_beak_size),
        	test_point),
    	test_point,
    	result_distance,
    	result_normal);    
    
    out_distance = result_distance;
    out_normal = result_normal;
}

vec3 get_rounded_shape_normal(
	vec2 flat_normal,
	float distance_to_shape,
	float shape_distance_outer_threshold)
{
    float linear_center_to_edge_fraction = saturate(distance_to_shape / shape_distance_outer_threshold);
    
    float rounded_center_to_edge_fraction = (asin(linear_center_to_edge_fraction) / radians(90.0));
        
    return
        mix(
    		vec3(0.0, 0.0, 1.0),
        	vec3(flat_normal, 0.0),
        	rounded_center_to_edge_fraction);
}
    
void main()
{
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    
    // Zoom-factor.
    st -= 0.5;
    st *= 3.0;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
    
    vec3 current_hours_minutes_seconds = get_hours_minutes_seconds(u_date.w);
    
    // st *= square_rotation(radians(10.0) * u_time);
    
    float digit_melt_fraction = smoothstep(-1.0, 1.0, sin(0.5 * u_time));
    
    float digit_distance_outer_threshold = 0.1;
    float digit_distance_inner_threshold = 0.07;
        
    float previous_digit_distance;
    vec2 previous_digit_normal;
    get_distance_and_normal_to_digit_1(st, previous_digit_distance, previous_digit_normal);    
    
    float current_digit_distance;
    vec2 current_digit_normal;
    get_distance_and_normal_to_digit_7(st, current_digit_distance, current_digit_normal);    
    
    vec3 previous_digit_rounded_normal = get_rounded_shape_normal(previous_digit_normal, previous_digit_distance, digit_distance_outer_threshold);
    vec3 current_digit_rounded_normal = get_rounded_shape_normal(current_digit_normal, current_digit_distance, digit_distance_outer_threshold);
    
    float blend_spikiness_power = 2.5;
    
    //float blended_digit_distance = mix(previous_digit_distance, current_digit_distance, digit_melt_fraction);
    float blended_digit_distance = 
        pow(
            mix(
                pow(previous_digit_distance, (1.0 / blend_spikiness_power)), 
                pow(current_digit_distance, (1.0 / blend_spikiness_power)), 
                digit_melt_fraction), 
            blend_spikiness_power);
    
    // NOTE: This approach the generating blended-normals is nonsense. It generally looks okay, but it isn't built on a decent foundation.
    vec3 blended_digit_normal = 
        normalize(get_rounded_shape_normal(
            mix(
                previous_digit_normal, 
                current_digit_normal, 
                smoothstep(previous_digit_distance, current_digit_distance, blended_digit_distance)),
        	blended_digit_distance,
        	digit_distance_outer_threshold));
        
    vec3 background_color = 
        mix(
			vec3(0.0),
    		vec3(0.2),
    		smoothstep(0.98, 1.02, max(abs(st.x), abs(st.y))));
    
    float digit_threshold_fraction = smoothstep(digit_distance_outer_threshold, digit_distance_inner_threshold, blended_digit_distance);
        
    vec3 color = mix(
    	background_color,
    	vec3(1.0),
    	digit_threshold_fraction);
    
    // Debug: Display the normals.    
    color.r = get_linear_fraction(-1.0, 1.0, blended_digit_normal.x) * digit_threshold_fraction;
    color.g = get_linear_fraction(-1.0, 1.0, blended_digit_normal.y) * digit_threshold_fraction;
    
    gl_FragColor = vec4(color, 1.0);
}