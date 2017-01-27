// Author: Austin Spafford
// Title: Chrono-Melt
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int; // Specifically needing since there are more than 2^15 seconds in a day.

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

vec3 get_analog_clock_hours_minutes_seconds(
    float seconds_since_midnight)
{
	return vec3(
		mod(seconds_since_midnight, (60.0 * 60.0 * 24.0)),
		mod(seconds_since_midnight, (60.0 * 60.0)),
		mod(seconds_since_midnight, 60.0));
}

void get_clock_digit_and_seconds_since_change(
    float seconds_since_midnight,
    int digit_index, // 01=HH, 23=mm, 45=ss
    out int out_current_digit_value,
    out int out_previous_digit_value,
	out float out_seconds_since_digit_changed)
{
    int seconds_per_number_increment;
    int increments_per_period;
    bool digit_is_tens_place;
    if (digit_index <= 1)
    {
        // Hours.
        seconds_per_number_increment = (60 * 60);
        increments_per_period = 24;
        digit_is_tens_place = (digit_index == 0);
    }
    else if (digit_index <= 3)
    {
        // Minutes.
        seconds_per_number_increment = 60;
        increments_per_period = 60;
        digit_is_tens_place = (digit_index == 2);
    }
    else
    {
        // Seconds.
        seconds_per_number_increment = 1;
        increments_per_period = 60;
        digit_is_tens_place = (digit_index == 4);
    }
    
    int seconds_per_period = (increments_per_period * seconds_per_number_increment);

    int whole_seconds_since_midnight = int(seconds_since_midnight);
    int starting_second_of_current_period = ((whole_seconds_since_midnight / seconds_per_period) * seconds_per_period);
    int whole_seconds_since_start_of_period = (whole_seconds_since_midnight - starting_second_of_current_period);
    
    int displayed_number = (whole_seconds_since_start_of_period / seconds_per_number_increment);
    
    // Output the current digit-value.
    {
        int tens_digit_value = (displayed_number / 10);
        int ones_digit_value = (displayed_number - (10 * tens_digit_value)); // We'd use integer-modulus, but it's not available until at least GLSL ES 3.0

        out_current_digit_value = (digit_is_tens_place ? tens_digit_value : ones_digit_value);
    }
    
    // Output the previous digit-value.
    {
        int previous_displayed_number = 
            (displayed_number > 0) ?
                (displayed_number - 1) :
                (increments_per_period - 1);    

        int previous_tens_digit_value = (previous_displayed_number / 10);
        int previous_ones_digit_value = (previous_displayed_number - (10 * previous_tens_digit_value)); // We'd use integer-modulus, but it's not available until at least GLSL ES 3.0

    	out_previous_digit_value = (digit_is_tens_place ? previous_tens_digit_value : previous_ones_digit_value);    
    }
    
    // Output the fractional seconds since the digit changed.
    {
        // NOTE: All floating point math is avoided until absolutely necessisary, specifically to avoid crappy-looking rounding bugs while animating the numbers.
        
        int seconds_per_digit_increment = 
            digit_is_tens_place ?
                (10 * seconds_per_number_increment) :
                seconds_per_number_increment;
        
        float fractional_seconds_since_start_of_period = (seconds_since_midnight - float(starting_second_of_current_period));

        out_seconds_since_digit_changed = mod(fractional_seconds_since_start_of_period, float(seconds_per_digit_increment)); 
    }
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
    
    float stem_pos_x = 0.12;
    vec2 stem_top = vec2(stem_pos_x, top_y);
    vec2 stem_bottom = vec2(stem_pos_x, bottom_y);
    
    vec2 beak_size = vec2(0.45, 0.7);
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
	out float out_distance,
	out vec2 out_normal)
{
	out_distance = distance(closest_point, test_point);
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

void get_distance_and_normal_for_blended_digit(
	int first_digit_value,
	int second_digit_value,
	float blending_fraction,
    float outer_shape_distance_threshold,
    vec2 test_point,
	out float out_distance,
	out vec3 out_rounded_normal)
{
    vec2 first_digit_closest_point = get_closest_point_on_indexed_digit(first_digit_value, test_point);
    vec2 second_digit_closest_point = get_closest_point_on_indexed_digit(second_digit_value, test_point);
                
    float first_digit_distance;
    vec2 first_digit_normal;
    convert_closest_point_to_distance_and_normal(first_digit_closest_point, test_point, first_digit_distance, first_digit_normal);    
    
    float second_digit_distance;
    vec2 second_digit_normal;
    convert_closest_point_to_distance_and_normal(second_digit_closest_point, test_point, second_digit_distance, second_digit_normal);
    
    vec3 first_digit_rounded_normal = get_rounded_shape_normal(first_digit_normal, first_digit_distance, outer_shape_distance_threshold);
    vec3 second_digit_rounded_normal = get_rounded_shape_normal(second_digit_normal, second_digit_distance, outer_shape_distance_threshold);
    
    float blend_spikiness_power = 2.5;
    
    //float blended_digit_distance = mix(first_digit_distance, second_digit_distance, digit_melt_fraction);
    out_distance =
        pow(
            mix(
                pow(first_digit_distance, (1.0 / blend_spikiness_power)), 
                pow(second_digit_distance, (1.0 / blend_spikiness_power)), 
                blending_fraction), 
            blend_spikiness_power);
    
    // NOTE: This approach the generating blended-normals is nonsense. It generally looks okay, but it isn't built on a decent foundation.
    out_rounded_normal =
        normalize(get_rounded_shape_normal(
            mix(
                first_digit_normal, 
                second_digit_normal, 
                smoothstep(first_digit_distance, second_digit_distance, out_distance)),
        	out_distance,
        	outer_shape_distance_threshold));   
}

vec2 get_closest_point_on_clock_separator(
	vec2 test_point)
{
    float top_dot_y = 0.25;
    float bottom_dot_y = -0.25;
    
    vec2 result =
    	(test_point.y > mix(bottom_dot_y, top_dot_y, 0.5)) ?
        	vec2(0.0, top_dot_y) :
    		vec2(0.0, bottom_dot_y);
    
    return result;
}

void get_distance_and_normal_for_clock_digit(
    float seconds_since_midnight,
	int clock_digit_index, // 01=HH, 23=mm, 45=ss
    float outer_shape_distance_threshold,
    vec2 test_point,
	out float out_distance,
	out vec3 out_rounded_normal)
{
    int current_digit_value;
    int previous_digit_value;
    float seconds_since_digit_changed;
	get_clock_digit_and_seconds_since_change(
        seconds_since_midnight,
        clock_digit_index,
        current_digit_value,
        previous_digit_value,
        seconds_since_digit_changed);
    
    float seconds_per_digit_blend = 1.0;
    
    float digit_blend_fraction = min(seconds_since_digit_changed, seconds_per_digit_blend);
    digit_blend_fraction = get_linear_fraction(-1.0, 1.0, sin(mix(radians(-90.0), radians(90.0), digit_blend_fraction)));
    //digit_blend_fraction = smoothstep(0.0, 0.5, digit_blend_fraction);
    //digit_blend_fraction = 1.0;
    
    // Debug-view a specific digit.
    //current_digit_value = previous_digit_value = 4;
    
    get_distance_and_normal_for_blended_digit(
    	previous_digit_value,
    	current_digit_value,
    	digit_blend_fraction,
    	outer_shape_distance_threshold,
        test_point,
    	out_distance,
    	out_rounded_normal);    
}

void get_distance_and_normal_for_clock(
    float seconds_since_midnight,
    float outer_shape_distance_threshold,
    vec2 test_point,
	out float out_distance,
	out vec3 out_rounded_normal)
{
    float digit_size_x = 0.9;
    float separator_size_x = 0.3;

    // Start on the hours tens-place.
    int digit_index = 0;
    float digit_right_edge_x = (0.0 - (digit_size_x + separator_size_x + digit_size_x));
    
    // Hours ones-place.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = 1;
        digit_right_edge_x += digit_size_x;
    }
    
    // Hours-to-minutes separator.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = -1; // Separator.
        digit_right_edge_x += separator_size_x;
    }
    
    // Minutes tens-place.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = 2;
        digit_right_edge_x += digit_size_x;
    }
    
    // Minutes ones-place.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = 3;
        digit_right_edge_x += digit_size_x;
    }
    
    // Minutes-to-seconds separator.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = -1; // Separator.
        digit_right_edge_x += separator_size_x;
    }
    
    // Seconds tens-place.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = 4;
        digit_right_edge_x += digit_size_x;
    }
    
    // Seconds ones-place.
    if (test_point.x > digit_right_edge_x)
    {
        digit_index = 5;
        digit_right_edge_x += digit_size_x;
    }
    
    if (digit_index >= 0)
    {
        get_distance_and_normal_for_clock_digit(
            seconds_since_midnight,
            digit_index,
            outer_shape_distance_threshold,
            (test_point - vec2((digit_right_edge_x - (digit_size_x / 2.0)), 0.0)),
            out_distance,
            out_rounded_normal);        
    }
    else
    {
        vec2 test_point_in_separator_space = 
            (test_point - vec2((digit_right_edge_x - (separator_size_x / 2.0)), 0.0));
        
        vec2 closest_point_on_separator = 
            get_closest_point_on_clock_separator(test_point_in_separator_space);
        
        vec2 separator_normal;
        convert_closest_point_to_distance_and_normal(
            closest_point_on_separator, 
            test_point_in_separator_space, 
            out_distance, 
            separator_normal);
        
        out_rounded_normal =
            normalize(get_rounded_shape_normal(
                separator_normal,
                out_distance,
                outer_shape_distance_threshold));  
    }
}
    
void main()
{
    vec2 st = (gl_FragCoord.xy / u_resolution.xy);
    
    // Zoom-factor.
    st -= 0.5;
    st *= 7.0;
    
    float texture_aspect_ratio = (u_resolution.x / u_resolution.y);
    
    // Perform aspect-ratio correction.
    st.x *= max(1.0, texture_aspect_ratio);
    st.y *= max(1.0, (1.0 / texture_aspect_ratio));
    
    // Crop down until the artwork is touching at least one pair of edges.
    {
        float artwork_aspect_ratio = 3.5;
        
        if ((artwork_aspect_ratio > 1.0) && (texture_aspect_ratio > 1.0))
        {
            st /= min(artwork_aspect_ratio, texture_aspect_ratio);
        }
        else if ((artwork_aspect_ratio < 1.0) && (texture_aspect_ratio < 1.0))
        {
            st *= max(artwork_aspect_ratio, texture_aspect_ratio);
        }
    }
        
    float seconds_since_midnight = u_date.w;
        
    //seconds_since_midnight *= 0.5;
    //seconds_since_midnight *= 2.0;
    
    // Trippy transition-waves.
    //seconds_since_midnight += (-0.5 * st.y);
    seconds_since_midnight += (0.25 * st.x);
    //seconds_since_midnight += (0.5 * smoothstep(-1.0, 1.0, sin(30.0 * length(st))));
    //seconds_since_midnight += (-1.0 * length(st));
    
    // st *= rotation_matrix(radians(10.0) * u_time);
    
    float digit_distance_outer_threshold = 0.1;
    float digit_distance_inner_threshold = (0.7 * digit_distance_outer_threshold);
    
    float blended_digit_distance;
    vec3 blended_digit_normal;
    get_distance_and_normal_for_clock(
        seconds_since_midnight,
        digit_distance_outer_threshold,
        st,
        blended_digit_distance,
        blended_digit_normal);
    
    float grid_fraction = 
        max(
        	smoothstep(0.02, 0.0, abs(fract(st.x) - 0.5)),
        	smoothstep(0.02, 0.0, abs(fract(st.y) - 0.5)));
        
    vec3 background_color = vec3(0.0);
    //background_color += (vec3(1.2) * grid_fraction);
    
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
    
    gl_FragColor = vec4(color, digit_threshold_fraction);
}



