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

float random(
    vec2 st)
{
    // From: https://thebookofshaders.com/10/
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
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

ivec3 get_clock_hours_minutes_seconds(
    float seconds_since_midnight)
{
	return ivec3(
		int(mod(seconds_since_midnight, (60.0 * 60.0 * 24.0))),
		int(mod(seconds_since_midnight, (60.0 * 60.0))),
		int(mod(seconds_since_midnight, 60.0)));
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

vec2 get_closest_point_on_circle(
	vec2 circle_center,
	float circle_radius,
	vec2 test_point)
{
	vec2 test_point_in_circle_space = (test_point - circle_center);
    
    vec2 closest_point_in_circle_space = (circle_radius * normalize(test_point_in_circle_space));
    
    vec2 result = (circle_center + closest_point_in_circle_space);
    
    return result;
}

vec2 get_closest_point_on_elliptical_arc(
	vec2 ellipse_center,
	vec2 ellipse_radii,
	float arc_start_fraction,
	float arc_end_fraction,
	vec2 test_point)
{
    arc_start_fraction = fract(arc_start_fraction);
    arc_end_fraction = fract(arc_end_fraction);
    
    if (arc_end_fraction <= arc_start_fraction)
    {
        arc_end_fraction += 1.0;
    }
    
    vec2 test_point_in_ellipse_space = ((test_point - ellipse_center) / ellipse_radii);
    
    float naive_closest_point_arc_fraction =
        fract((atan(test_point_in_ellipse_space.y, test_point_in_ellipse_space.x) / radians(360.0)) + 1.0);
    
    // Center the naive closest point around arc.
    float arc_midpoint_fraction = mix(arc_start_fraction, arc_end_fraction, 0.5);
    
    if (abs(naive_closest_point_arc_fraction - arc_midpoint_fraction) > abs((naive_closest_point_arc_fraction + 1.0) - arc_midpoint_fraction))
    {
        naive_closest_point_arc_fraction += 1.0;
    }
    else if (abs(naive_closest_point_arc_fraction - arc_midpoint_fraction) > abs((naive_closest_point_arc_fraction - 1.0) - arc_midpoint_fraction))
    {
        naive_closest_point_arc_fraction -= 1.0;
    }
    
    float arc_length_fraction = (arc_end_fraction - arc_start_fraction);
        
    float clamped_closest_point_arc_fraction =
        ((arc_start_fraction <= naive_closest_point_arc_fraction) && (naive_closest_point_arc_fraction <= arc_end_fraction)) ?
        	naive_closest_point_arc_fraction :
        	((abs(naive_closest_point_arc_fraction - arc_start_fraction) < abs(naive_closest_point_arc_fraction - arc_end_fraction)) ? arc_start_fraction : arc_end_fraction);
    
    vec2 closest_point_in_ellipse_space = vec2(
        cos(clamped_closest_point_arc_fraction * radians(360.0)),
    	sin(clamped_closest_point_arc_fraction * radians(360.0)));
    
    vec2 closest_point =
        ((closest_point_in_ellipse_space * ellipse_radii) + ellipse_center);
        
    return closest_point;
}

void upgrade_closest_point(
    vec2 candidate_closest_point,
    vec2 test_point,
    inout vec2 inout_closest_point)
{
    if (distance_sq(candidate_closest_point, test_point) < distance_sq(inout_closest_point, test_point))
    {
        inout_closest_point = candidate_closest_point;
    }
}

vec2 get_closest_point_on_digit_0(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float aspect_ratio = 0.6;
    //aspect_ratio = 1.0 + cos(u_time); 
    
    float radius_y = ((top_y - bottom_y) / 2.0);
    
    vec2 result =
        get_closest_point_on_elliptical_arc(
    		vec2(0.0, mix(bottom_y, top_y, 0.5)), // center
    		vec2((aspect_ratio * radius_y), radius_y), // radii
    		0.0, // arc_start_fraction
    		1.0, // arc_end_fraction
    		test_point);
    
    return result;
}

vec2 get_closest_point_on_digit_1(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float bottom_foot_size_x = 0.3;
    vec2 top_beak_size = vec2(0.15, 0.15);
    
    vec2 stem_top = vec2(0.0, top_y);
    vec2 stem_bottom = vec2(0.0, bottom_y);
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_top,
        	stem_bottom,
        	test_point);
    
    // Beak.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            stem_top,
        	(stem_top - top_beak_size),
        	test_point),
    	test_point,
    	result);
    
    // Foot.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            (stem_bottom - vec2((bottom_foot_size_x / 2.0), 0.0)),
        	(stem_bottom + vec2((bottom_foot_size_x / 2.0), 0.0)),
        	test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_2(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float bottom_foot_size_x = 0.6;
    
    vec2 beak_radii = vec2(bottom_foot_size_x / 2.0);
    vec2 beak_center = vec2(0.0, (top_y - beak_radii.y));
    float beak_arc_start_fraction = 0.87;
    float beak_arc_end_fraction = 0.47;
    
    vec2 beak_lowest_point = 
    	 get_closest_point_on_elliptical_arc(
    		beak_center,
    		beak_radii,
    		beak_arc_start_fraction,
    		beak_arc_end_fraction,
    		vec2(0.0, bottom_y));
    
    vec2 stem_top = beak_lowest_point;
    vec2 stem_bottom = vec2((-1.0 * (bottom_foot_size_x / 2.0)), bottom_y);
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_top,
        	stem_bottom,
        	test_point);
    
    // Beak.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		beak_center,
    		beak_radii,
    		beak_arc_start_fraction,
    		beak_arc_end_fraction,
    		test_point),
    	test_point,
    	result);
    
    // Foot.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            (stem_bottom),
        	(stem_bottom + vec2(bottom_foot_size_x, 0.0)),
        	test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_3(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float size_x = 0.55;
    float size_y = (top_y - bottom_y);
    
    vec2 arm_radii = vec2((size_x / 2.0), (size_y / 4.0));
    
    vec2 upper_arm_center = vec2(0.0, (top_y - arm_radii.y));
    float upper_arm_arc_start_fraction = 0.77;
    float upper_arm_arc_end_fraction = 0.45;
    
    vec2 lower_arm_center = vec2(0.0, (bottom_y + arm_radii.y));
    float lower_arm_arc_start_fraction = 0.55;
    float lower_arm_arc_end_fraction = 0.23;
    
    // Upper-arm.
    vec2 result = 
    	 get_closest_point_on_elliptical_arc(
    		upper_arm_center,
    		arm_radii,
    		upper_arm_arc_start_fraction,
    		upper_arm_arc_end_fraction,
    		test_point);
    
    // Lower-arm.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		lower_arm_center,
    		arm_radii,
    		lower_arm_arc_start_fraction,
    		lower_arm_arc_end_fraction,
    		test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_4(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float stem_pos_x = 0.1;
    vec2 stem_top = vec2(stem_pos_x, top_y);
    vec2 stem_bottom = vec2(stem_pos_x, bottom_y);
    
    vec2 beak_size = vec2(0.5, 0.7);
    vec2 beak_bottom = (stem_top - beak_size);
    
    float cross_bar_overextension_size_x = 0.2;
    vec2 cross_bar_right = vec2((stem_pos_x + cross_bar_overextension_size_x), beak_bottom.y);
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_top,
        	stem_bottom,
        	test_point);
    
    // Beak.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            stem_top,
        	beak_bottom,
        	test_point),
    	test_point,
    	result);
    
    // Cross-bar.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            beak_bottom,
        	cross_bar_right,
        	test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_5(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    vec2 bowl_radii = vec2(0.35, 0.3);
    vec2 bowl_center = vec2(0.0, (bottom_y + bowl_radii.y));
    float bowl_arc_start_fraction = 0.58;
    float bowl_arc_end_fraction = 0.38;
    
    vec2 stem_top = vec2(-0.2, top_y);
    
    vec2 stem_bottom = 
    	 get_closest_point_on_elliptical_arc(
    		bowl_center,
    		bowl_radii,
    		(bowl_arc_end_fraction - 0.001),
    		bowl_arc_end_fraction,
    		(bowl_center + vec2((-1.0 * bowl_radii.x), 0.0)));
    
    vec2 arm_right = vec2(0.32, stem_top.y);
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_top,
        	stem_bottom,
        	test_point);
    
    // Arm.
    upgrade_closest_point(
    	get_closest_point_on_line_segment(
        	stem_top,
        	arm_right,
        	test_point),
    	test_point,
    	result);
    
    // Bowl.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		bowl_center,
    		bowl_radii,
    		bowl_arc_start_fraction,
    		bowl_arc_end_fraction,
    		test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_6(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    vec2 bowl_radii = vec2(0.25, 0.3);
    vec2 bowl_center = vec2(0.0, (bottom_y + bowl_radii.y));
    float bowl_arc_start_fraction = 0.0;
    float bowl_arc_end_fraction = 1.0;
    
    vec2 stem_size = vec2(0.00, 0.35);
    vec2 stem_bottom = vec2((bowl_center.x - bowl_radii.x), bowl_center.y);
    vec2 stem_top = (stem_bottom + stem_size);
    
    float beak_offset_x = 0.02;
    vec2 beak_radii = vec2((bowl_radii.x + beak_offset_x), (top_y - stem_top.y));
    vec2 beak_center = vec2(beak_offset_x, stem_top.y);
    float beak_arc_start_fraction = 0.08;
    float beak_arc_end_fraction = 0.5;
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_top,
        	stem_bottom,
        	test_point);
    
    // Beak.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		beak_center,
    		beak_radii,
    		beak_arc_start_fraction,
    		beak_arc_end_fraction,
    		test_point),
    	test_point,
    	result);
    
    // Bowl.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		bowl_center,
    		bowl_radii,
    		bowl_arc_start_fraction,
    		bowl_arc_end_fraction,
    		test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_7(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    float top_arm_size_x = 0.6;
    
    vec2 stem_bottom = vec2(-0.1, bottom_y);
    vec2 stem_top = vec2((top_arm_size_x / 2.0), top_y);
    
    vec2 arm_left = vec2((-1.0 * (top_arm_size_x / 2.0)), top_y);
    
    vec2 beak_size = vec2(0.0, 0.05);
    
    // Stem.
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_bottom,
        	stem_top,
        	test_point);
    
    // Top-edge.
    upgrade_closest_point(    	
    	get_closest_point_on_line_segment(
            stem_top,
        	arm_left,
        	test_point),
    	test_point,
    	result);
    
    // Beak.
    upgrade_closest_point(
    	get_closest_point_on_line_segment(
            arm_left,
        	(arm_left - beak_size),
        	test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_8(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
    
    vec2 digit_size = vec2(0.5, (top_y - bottom_y));    
    
    float bottom_bowl_size_y_ratio = 0.53;
    
    float neck_y = mix(bottom_y, top_y, bottom_bowl_size_y_ratio);
    
    vec2 upper_bowl_radii = vec2((digit_size.x / 2.0), ((top_y - neck_y) / 2.0));
    vec2 upper_bowl_center = vec2(0.0, (top_y - upper_bowl_radii.y));
    
    vec2 lower_bowl_radii = vec2(upper_bowl_radii.x, ((neck_y - bottom_y) / 2.0));
    vec2 lower_bowl_center = vec2(0.0, (bottom_y + lower_bowl_radii.y));
    
    // Upper-bowl.
    vec2 result = 
    	 get_closest_point_on_elliptical_arc(
    		upper_bowl_center,
    		upper_bowl_radii,
    		0.0, // arc_start_fraction
    		1.0, // arc_end_fraction
    		test_point);
    
    // Lower-bowl.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		lower_bowl_center,
    		lower_bowl_radii,
    		0.0, // arc_start_fraction
    		1.0, // arc_end_fraction
    		test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_digit_9(
	vec2 test_point)
{
    float top_y = 0.5;
    float bottom_y = -0.5;
        
    vec2 bowl_radii = vec2(0.24, 0.25);
    vec2 bowl_center = vec2(0.0, (top_y - bowl_radii.y));
        
    vec2 stem_bottom = vec2(-0.05, bottom_y);
    
    // Approximate the tangent-point.
    float stem_cheated_tangent_arc_fraction = 0.93;
    vec2 stem_top =
    	 get_closest_point_on_elliptical_arc(
    		bowl_center,
    		bowl_radii,
    		stem_cheated_tangent_arc_fraction,
    		(stem_cheated_tangent_arc_fraction + 0.001),
    		stem_bottom);
    
    // Stem
    vec2 result = 
    	get_closest_point_on_line_segment(
        	stem_bottom,
        	stem_top,
        	test_point);
    
    // Upper-bowl.
    upgrade_closest_point(
    	 get_closest_point_on_elliptical_arc(
    		bowl_center,
    		bowl_radii,
    		0.0, // arc_start_fraction
    		1.0, // arc_end_fraction
    		test_point),
    	test_point,
    	result);
    
    return result;
}

vec2 get_closest_point_on_indexed_digit(
    int digit_value,
	vec2 test_point)
{    
    vec2 result;
    
    if (digit_value < 8)
    {
        if (digit_value < 4)
        {
            if (digit_value < 2)
            {
                if (digit_value == 0)
                {
                    result = get_closest_point_on_digit_0(test_point);
                }
                else
                {
                    result = get_closest_point_on_digit_1(test_point);
                }
            }
            else // >= 2
            {
                if (digit_value == 2)
                {
                    result = get_closest_point_on_digit_2(test_point);
                }
                else
                {
                    result = get_closest_point_on_digit_3(test_point);
                }
            }
        }
        else // >= 3
        {
            if (digit_value < 6)
            {
                if (digit_value == 4)
                {
                    result = get_closest_point_on_digit_4(test_point);
                }
                else
                {
                    result = get_closest_point_on_digit_5(test_point);
                }
            }
            else // >= 6
            {
                if (digit_value == 6)
                {
                    result = get_closest_point_on_digit_6(test_point);
                }
                else
                {
                    result = get_closest_point_on_digit_7(test_point);
                }
            }
        }
    }
    else // >= 8
    {
        if (digit_value == 8)
        {
            result = get_closest_point_on_digit_8(test_point);
        }
        else
        {
            result = get_closest_point_on_digit_9(test_point);
        }
    }
    
    return result;
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
    vec2 st = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom-factor.
    st -= 0.5;
    st *= 2.2;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
        
    float seconds_since_midnight = u_date.w;
        
    // Slow down time.
    //seconds_since_midnight *= 0.5;
    
    // Trippy transition-waves.
    //seconds_since_midnight += (-0.5 * st.y);
    //seconds_since_midnight += (0.5 * smoothstep(-1.0, 1.0, sin(30.0 * length(st))));
    //seconds_since_midnight += (-1.0 * length(st));
    
    ivec3 current_hours_minutes_seconds = get_clock_hours_minutes_seconds(seconds_since_midnight);
    float current_subsecond_fraction = fract(seconds_since_midnight);
    
    // st *= rotation_matrix(radians(10.0) * u_time);
    
    //float digit_melt_fraction = smoothstep(0.0, 0.5, current_subsecond_fraction);
    float digit_melt_fraction = get_linear_fraction(-1.0, 1.0, sin(mix(radians(-90.0), radians(90.0), current_subsecond_fraction)));
    //digit_melt_fraction = 1.0;
    
    float digit_distance_outer_threshold = 0.1;
    float digit_distance_inner_threshold = 0.07;
    
    int current_second_digit_value = int_mod(current_hours_minutes_seconds.z, 10);
    
    int previous_digit_value = 
        (current_second_digit_value > 0) ?
        	(current_second_digit_value - 1) :
    		9;
    
    int current_digit_value = current_second_digit_value;
    
    // Debug-view a specific digit.
    //current_digit_value = previous_digit_value = 9;
    
    vec2 previous_digit_closest_point = get_closest_point_on_indexed_digit(previous_digit_value, st);
    vec2 current_digit_closest_point = get_closest_point_on_indexed_digit(current_digit_value, st);
                
    float previous_digit_distance;
    vec2 previous_digit_normal;
    convert_closest_point_to_distance_and_normal(previous_digit_closest_point, st, previous_digit_distance, previous_digit_normal);    
    
    float current_digit_distance;
    vec2 current_digit_normal;
    convert_closest_point_to_distance_and_normal(current_digit_closest_point, st, current_digit_distance, current_digit_normal);
    
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
    
    float visualized_distance = blended_digit_distance;
    //visualized_distance += (-0.1 * u_time);
    //color += mix(0.0, 0.5, smoothstep(-1.0, 1.0, sin(100.0 * visualized_distance)));
    
    gl_FragColor = vec4(color, 1.0);
}



