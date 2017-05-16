// Author: Austin Spafford
// Title: The Herbert Slide
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int; // Specifically needing since there are more than 2^15 seconds in a day.

uniform sampler2D u_cat_texture; // https://images-na.ssl-images-amazon.com/images/I/910PPWWqFuL.png
uniform sampler2D u_samus_texture; // https://f4.bcbits.com/img/0004338483_20.jpg

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

const int k_herbert_iterations = 10;

vec2 s_mouse_fractions; // (u_mouse / u_resolution)

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

float linear_fraction(
	float min,
	float max,
	float value)
{
	return (min != max) ?
        ((value - min) / (max - min)) :
    	step(value, max);
}

vec2 linear_fraction(
	vec2 min,
	vec2 max,
	vec2 value)
{
	return vec2(
    	linear_fraction(min.x, max.x, value.x),
        linear_fraction(min.y, max.y, value.y));
}

float clamped_linear_fraction(
	float min,
	float max,
	float value)
{
	return clamp(linear_fraction(min, max, value), 0.0, 1.0);
}

float trig_cycle_fraction(
	float domain_fraction)
{
    // Smoothly moves through: (0.0, 0.0), (0.5, 1.0), (1.0, 0.0)
    return linear_fraction(1.0, -1.0, cos(mix(0.0, radians(360.0), domain_fraction)));
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
    	vec2(cosine_theta, sine_theta), // x-basis
        vec2((-1.0 * sine_theta), cosine_theta)); // y-basis
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

float get_hilbert_fraction(
	vec2 test_point)
{
    // NOTE: This function orients the curve with the open-side facing downwards, like this: https://upload.wikimedia.org/wikipedia/commons/a/a5/Hilbert_curve.svg
    
    float result = 0.0;
    
    if ((-1.0 <= test_point.x) && (test_point.x <= 1.0) &&
        (-1.0 <= test_point.y) && (test_point.y <= 1.0))
    {
        vec2 result_fraction_range = vec2(0.0, 1.0);
        
        float half_iteration_radius = 0.5;
        
        for (int iteration_index = 0; iteration_index < k_herbert_iterations; ++iteration_index)
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
                    // Upper-left.
                    test_point += (vec2(1.0, -1.0) * half_iteration_radius);
                    quadrant_local_fraction_range = vec2(0.25, 0.5);
                }
                else
                {
                    // Lower-left.
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

vec2 get_hilbert_coordinate(
	float hilbert_fraction)
{
    // NOTE: This function orients the curve with the open-side facing downwards, like this: https://upload.wikimedia.org/wikipedia/commons/a/a5/Hilbert_curve.svg
    
    vec2 result = vec2(0.0);
    
    if ((0.0 <= hilbert_fraction) && (hilbert_fraction <= 1.0))
    {
        vec2 cell_fraction_range = vec2(0.0, 1.0);
        mat3 cell_transform = mat3(
            vec3(1.0, 0.0, 0.0), // x-basis
            vec3(0.0, 1.0, 0.0), // y-basis
            vec3(0.0, 0.0, 1.0)); // w-basis
        
        for (int iteration_index = 0; iteration_index < k_herbert_iterations; ++iteration_index)
        {
            vec2 subcell_local_fraction_range;
            mat3 subcell_local_transform;
                
            if (hilbert_fraction >= mix(cell_fraction_range.x, cell_fraction_range.y, 0.75))
            {
                // Lower-right.
                subcell_local_fraction_range = vec2(0.75, 1.0);
                subcell_local_transform = mat3(
                    vec3(0.0, -0.5, 0.0), // x-basis
                    vec3(-0.5, 0.0, 0.0), // y-basis
                    vec3(0.5, -0.5, 1.0)); // w-basis
            }
            else if (hilbert_fraction >= mix(cell_fraction_range.x, cell_fraction_range.y, 0.5))
            {
                // Upper-right.
                subcell_local_fraction_range = vec2(0.5, 0.75);
                subcell_local_transform = mat3(
                    vec3(0.5, 0.0, 0.0), // x-basis
                    vec3(0.0, 0.5, 0.0), // y-basis
                    vec3(0.5, 0.5, 1.0)); // w-basis
            }
            else if (hilbert_fraction >= mix(cell_fraction_range.x, cell_fraction_range.y, 0.25))
            {
                // Upper-left.
                subcell_local_fraction_range = vec2(0.25, 0.5);
                subcell_local_transform = mat3(
                    vec3(0.5, 0.0, 0.0), // x-basis
                    vec3(0.0, 0.5, 0.0), // y-basis
                    vec3(-0.5, 0.5, 1.0)); // w-basis
            }
            else
            {
                // Lower-left.
                subcell_local_fraction_range = vec2(0.0, 0.25);
                subcell_local_transform = mat3(
                    vec3(0.0, 0.5, 0.0), // x-basis
                    vec3(0.5, 0.0, 0.0), // y-basis
                    vec3(-0.5, -0.5, 1.0)); // w-basis
            }
            
            // Move into the sub-cell.
            cell_fraction_range = mix(cell_fraction_range.xx, cell_fraction_range.yy, subcell_local_fraction_range);            
            cell_transform = (cell_transform * subcell_local_transform); // NOTE: We're intentionally applying the transforms in the reverse of typical matrix usage.
        }
    
        result = (cell_transform * vec3(0.0, 0.0, 1.0)).xy;
    }
    
    return result;
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    s_mouse_fractions = (u_mouse / u_resolution.xy);
    
    // Zoom-factor.
    test_point -= 0.5;
    test_point *= 2.0;
    
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
        
    //test_point = (fract(test_point + vec2(0.5)) - vec2(0.5)); // Tile infinitely.
    
    //test_point *= rotation_matrix(radians(10.0) * u_time);
    
    float hilbert_fraction = get_hilbert_fraction(test_point);
    
    vec3 hilbert_color;
    
    if (hilbert_fraction > 0.0)
    {
    	float base_animated_hilbert_fraction = fract((1.0 * (hilbert_fraction) + -0.07 * u_time));
        
        float pulse_animated_hilbert_fraction = fract((20.0 * (hilbert_fraction) + -0.01 * u_time));
        float fractal_pulse_fraction = (smoothstep(0.3, 0.5, pulse_animated_hilbert_fraction) * smoothstep(0.501, 0.5, pulse_animated_hilbert_fraction));
        
    	hilbert_color = hsb_to_rgb(vec3(base_animated_hilbert_fraction, 1.0, 1.0));
        //hilbert_color = mix(vec3(0.0), vec3(1.0), fractal_pulse_fraction);
        //hilbert_color = hsb_to_rgb(vec3(base_animated_hilbert_fraction, 1.0, (1.0 - fractal_pulse_fraction)));
        
        float manual_hilbert_fraction_offset = linear_fraction(0.5, 200.0, s_mouse_fractions.x);
        float animated_hilbert_fraction_offset = (-0.03 * trig_cycle_fraction(clamped_linear_fraction(0.1, 1.0, fract(0.1 * u_time))));
        float sild_hilbert_fraction = fract(hilbert_fraction + mix(manual_hilbert_fraction_offset, animated_hilbert_fraction_offset, smoothstep(0.2, 0.8, s_mouse_fractions.y)));
        vec2 slid_hilbert_point = get_hilbert_coordinate(sild_hilbert_fraction);
        
        vec2 texture_sample_point = linear_fraction(vec2(-1.0), vec2(1.0), slid_hilbert_point);
        
        hilbert_color = texture2D(u_cat_texture, texture_sample_point).rgb;
    }
    else
	{
        hilbert_color = vec3(0.0);
    }
    
    float grid_fraction = 
        max(
        	smoothstep(0.02, 0.0, abs(fract(test_point.x) - 0.5)),
        	smoothstep(0.02, 0.0, abs(fract(test_point.y) - 0.5)));
        
    vec3 background_color = vec3(0.0);
    background_color += (vec3(1.2) * grid_fraction);
    
    float digit_threshold_fraction = 0.0;
        
    vec3 color = hilbert_color;
    
    gl_FragColor = vec4(color, 1.0);
}

