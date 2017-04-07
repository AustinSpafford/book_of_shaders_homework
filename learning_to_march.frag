// Author: Austin Spafford
// Title: Learning to March
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_pi = radians(180.0);
const float k_tau = radians(360.0);

const int k_bloblet_count = 32;

const bool k_blob_enabled = true;
const bool k_ground_enabled = true;

const int k_samples_per_axis = 1; // "1" for per-pixel sampling, "2" for 4xSSAA, etc.

const float k_raymarch_precision = 0.001;
const float k_raymarch_escape_distance = 10.0;

vec4 s_bloblets[k_bloblet_count]; // (position, strength)
vec2 s_mouse_fractions; // (u_mouse / u_resolution)

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
    
float linear_fraction(
	float min,
	float max,
	float value)
{
	return (min != max) ?
        ((value - min) / (max - min)) :
    	step(value, max);
}

float trig_cycle_fraction(
	float domain_fraction)
{
    // Smoothly moves through: (0.0, 0.0), (0.5, 1.0), (1.0, 0.0)
    return linear_fraction(1.0, -1.0, cos(mix(0.0, radians(360.0), domain_fraction)));
}

float clamped_linear_fraction(
	float min,
	float max,
	float value)
{
	return clamp(linear_fraction(min, max, value), 0.0, 1.0);
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
    float cos_theta = cos(theta);
    float sin_theta = sin(theta);
    
    return mat2(
    	cos_theta, sin_theta, // x-basis
        (-1.0 * sin_theta), cos_theta); // y-basis
}

mat3 rotation_matrix_x(
	float theta)
{
    float cos_theta = cos(theta);
    float sin_theta = sin(theta);
    
    return mat3(
    	1.0, 0.0, 0.0, // x-basis
        0.0, cos_theta, sin_theta, // y-basis
        0.0, (-1.0 * sin_theta), cos_theta); // z-basis
}

mat3 rotation_matrix_y(
	float theta)
{
    float cos_theta = cos(theta);
    float sin_theta = sin(theta);
    
    return mat3(
    	cos_theta, 0.0, (-1.0 * sin_theta), // x-basis
        0.0, 1.0, 0.0, // y-basis
        sin_theta, 0.0, cos_theta); // z-basis
}

mat3 rotation_matrix_z(
	float theta)
{
    float cos_theta = cos(theta);
    float sin_theta = sin(theta);
    
    return mat3(
    	cos_theta, sin_theta, 0.0, // x-basis
        (-1.0 * sin_theta), cos_theta, 0.0, // y-basis
        0.0, 0.0, 1.0); // z-basis
}

float layered_pulses(
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

float smooth_min(
    float first_value,
    float second_value,
    float smoothing_distance)
{
    // Credit: http://www.iquilezles.org/www/articles/smin/smin.htm
    float blend_fraction = saturate(0.5 + (0.5 * ((first_value - second_value) / smoothing_distance)));
    return (
        mix(first_value, second_value, blend_fraction) - 
        (smoothing_distance * (blend_fraction * (1.0 - blend_fraction))));
}

float sample_sphere_distance(
	vec3 test_point,
    vec4 sphere_pos_radius)
{
    return (distance(test_point, sphere_pos_radius.xyz) - sphere_pos_radius.w);
}

float sample_blob_bounds_distance(
	vec3 test_point)
{
    float result = 100.0;
    
    for (int bloblet_index = 0; bloblet_index < k_bloblet_count; bloblet_index++)
	{
        float bloblet_distance =
            sample_sphere_distance(
                test_point,
                s_bloblets[bloblet_index]);
        
        result = smooth_min(result, bloblet_distance, 0.1);
    }
    
    return result;
}

float sample_ground_distance(
	vec3 test_point)
{
    float ground_y = -1.0;
    return (test_point.y - ground_y);
}

float sample_scene_distance(
	vec3 test_point)
{
    float result = 1000.0;
    
    // Blob
    if (k_blob_enabled)
    {
        result = min(result, sample_blob_bounds_distance(test_point));
    }
    
    // Ground
    if (k_ground_enabled)
    {
        result = min(result, sample_ground_distance(test_point));
    }
    
    return result;
}

vec3 sample_scene_albedo(
	vec3 test_point)
{
    vec3 result = vec3(0.0);
    
    float closest_distance = 1000.0;
    
    // Blob
    if (k_blob_enabled)
    {
        float object_distance = sample_blob_bounds_distance(test_point);
        
        if (object_distance < closest_distance)
        {
			closest_distance = object_distance;
            result = vec3(0.0, 1.0, 1.0);
            
            // Fruity colors.
            if (true)
            {
                vec4 summed_blob_color = vec4(0.0001);
                
                for (int bloblet_index = 0; bloblet_index < k_bloblet_count; bloblet_index++)
                {
                    float bloblet_distance =
                        sample_sphere_distance(
                            test_point,
                            s_bloblets[bloblet_index]);
                    
                    float bloblet_color_fraction = pow(smoothstep(0.3, 0.0, bloblet_distance), 2.0);
                    
                    summed_blob_color +=
                        vec4(
                    		(bloblet_color_fraction * hsb_to_rgb(vec3((float(bloblet_index) / float(k_bloblet_count)), 0.95, 1.0))),
                    		bloblet_color_fraction);
                }
                
                result = (summed_blob_color.rgb / summed_blob_color.a);
            }
        }
    }
    
    // Ground
    if (k_ground_enabled)
    {
        float object_distance = sample_ground_distance(test_point);
        
        if (object_distance < closest_distance)
        {
            const float fuzziness = 0.04;
            
			closest_distance = object_distance;
            result = 
                mix(
                	vec3(0.1),
                	vec3(0.9),
                	abs((smoothstep(-fuzziness, fuzziness, cos(k_tau * test_point.x)) + smoothstep(-fuzziness, fuzziness, cos(k_tau * test_point.z))) - 1.0));
        }
    }
    
    return result;
}

vec3 compute_scene_gradient(
	vec3 test_point)
{
    vec3 x_step = vec3(k_raymarch_precision, 0.0, 0.0);
    vec3 y_step = x_step.yxy;
    vec3 z_step = x_step.yyx;
    
    return normalize(vec3(
    	(sample_scene_distance(test_point + x_step) - sample_scene_distance(test_point - x_step)),
        (sample_scene_distance(test_point + y_step) - sample_scene_distance(test_point - y_step)),
    	(sample_scene_distance(test_point + z_step) - sample_scene_distance(test_point - z_step))));
}

void raymarch_scene(
	vec3 ray_origin,
	vec3 ray_direction,
	out float out_raymarch_distance,
    out bool out_ray_intersects_scene,
	out int out_debug_step_count)
{
    out_ray_intersects_scene = false;
    out_raymarch_distance = 0.0;
    out_debug_step_count = 0;
    
    for (int sample_index = 0; sample_index < 50; sample_index++)
    {        
        float sample_distance = sample_scene_distance(ray_origin + (ray_direction * out_raymarch_distance));
        
        out_raymarch_distance += sample_distance;
        out_debug_step_count++;        
        
        if (sample_distance < k_raymarch_precision)
        {
            out_ray_intersects_scene = true;
            break;
        }
        
        if (out_raymarch_distance > k_raymarch_escape_distance)
        {
            out_ray_intersects_scene = false;
            break;
        }
    }
}

void compute_scene_raymarch_color_raw(
	vec3 ray_origin,
	vec3 ray_direction,
    out bool out_ray_intersects_scene,
	out vec3 out_ray_color,
	out vec3 out_termination_point,
	out vec3 out_termination_normal,
	out int out_debug_step_count)
{
    out_ray_intersects_scene = false;
    out_ray_color = vec3(0.0);
    out_termination_point = vec3(0.0);
    out_termination_normal = vec3(0.0001);
    out_debug_step_count = 0;
    
	float raymarch_distance;
    raymarch_scene(
        ray_origin,
        ray_direction,
        raymarch_distance,
        out_ray_intersects_scene,
        out_debug_step_count);
    
    out_termination_point = (ray_origin + (ray_direction * raymarch_distance));
    
    if (out_ray_intersects_scene)
    {
        vec3 surface_point = out_termination_point;
		vec3 surface_albedo = sample_scene_albedo(surface_point);
        
        out_termination_normal = compute_scene_gradient(surface_point);
            
        vec3 global_light = normalize(vec3(1.0, 1.0, 0.5));
        
        vec3 received_light = vec3(1.0);        
        //received_light *= smoothstep(-0.7, 1.0, dot(out_termination_normal, global_light));
        received_light *= saturate(dot(out_termination_normal, global_light));
        
        // Shadows.
        if (true)
        {
            float sh_raymarch_distance;
            bool sh_ray_intersects_scene;
            int sh_debug_step_counts;
            raymarch_scene(
                (surface_point + (out_termination_normal * (2.0 * k_raymarch_precision))), // ray_origin
                global_light, // ray_direction
                sh_raymarch_distance,
                sh_ray_intersects_scene,
                sh_debug_step_counts);
            
            float shadow_term = pow(smoothstep(1.0, 10.0, sh_raymarch_distance), 1.0);
            
            received_light *= shadow_term;
        }
        
        // Basic ambient light.
        if (true)
        {
            received_light = max(received_light, 0.2);            
        }
        
        // Cheesy ambient occlusion.
        if (false)
        {
            float ao_raymarch_distance;
            bool ao_ray_intersects_scene;
            int ao_debug_step_counts;
            raymarch_scene(
                (surface_point + (out_termination_normal * (2.0 * k_raymarch_precision))), // ray_origin
                out_termination_normal, // ray_direction
                ao_raymarch_distance,
                ao_ray_intersects_scene,
                ao_debug_step_counts);
            
            received_light *= 
                ao_ray_intersects_scene ?
                	mix(0.5, 1.0, pow(smoothstep(0.0, 0.5, ao_raymarch_distance), 0.5)) :
            		1.0;
        }        

        vec3 surface_color = (surface_albedo * received_light);
        //surface_color = out_termination_normal;
        
        out_ray_color = surface_color;
    }
}

vec4 compute_scene_raymarch_color(
	vec3 ray_origin,
	vec3 ray_direction)
{
    vec4 result = vec4(0.0);
    
    bool ray_intersects_scene;
	vec3 ray_color;
	vec3 termination_point;
	vec3 termination_normal;
	int debug_step_count; 
    compute_scene_raymarch_color_raw(
        ray_origin,
        ray_direction,
        ray_intersects_scene,
		ray_color,
		termination_point,
		termination_normal,
    	debug_step_count);
    
    if (ray_intersects_scene)
    {
        result = vec4(ray_color, 1.0);
        
        // Reflections!
        if (true)
        {
            vec3 rfl_ray_origin = (termination_point + (termination_normal * (2.0 * k_raymarch_precision)));
            vec3 rfl_ray_direction = reflect(ray_direction, termination_normal);
                
            bool rfl_ray_intersects_scene;
            vec3 rfl_ray_color;
            vec3 rfl_termination_point;
            vec3 rfl_termination_normal;
            int rfl_debug_step_count; 
            compute_scene_raymarch_color_raw(
                rfl_ray_origin,
                rfl_ray_direction,
                rfl_ray_intersects_scene,
                rfl_ray_color,
                rfl_termination_point,
                rfl_termination_normal,
                rfl_debug_step_count);
            
            rfl_ray_color = (rfl_ray_intersects_scene ? rfl_ray_color : vec3(0.0));
            
            result = mix(result, vec4(rfl_ray_color, 1.0), 0.25);
            
            debug_step_count += rfl_debug_step_count;
        }
    }

    // Visualize the expense of the raymarch.
    if (false)
    {
        result = 
            mix(
                result,
                mix(vec4(0.0, 1.0, 1.0, 1.0), vec4(1.0, 0.0, 0.0, 1.0), pow((float(debug_step_count) / 120.0), 0.5)),
                smoothstep(-0.01, 0.0, ((gl_FragCoord.x / u_resolution.x) - s_mouse_fractions.x)));//smoothstep(0.25, 0.75, s_mouse_fractions.x));//smoothstep(0.3, 0.7, trig_cycle_fraction(0.2 * u_time)));
    }
    
    return result;
}
    
void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    s_mouse_fractions = (u_mouse / u_resolution.xy);
    
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
    
    // Compute the blob parameters.
    for (int bloblet_index = 0; bloblet_index < k_bloblet_count; bloblet_index++)
    {
        vec3 bloblet_movement_rates =
            vec3(
                mix(0.02, 0.1, random(vec2(float(bloblet_index), 0.0))),
                mix(0.02, 0.1, random(vec2(float(bloblet_index), 0.1))),
                mix(0.02, 0.1, random(vec2(float(bloblet_index), 0.2))));
        
        s_bloblets[bloblet_index] = vec4(
            (0.75 * vec3(1.0, 1.0, 1.0) * sin(k_tau * bloblet_movement_rates * u_time)),
            (0.3 * mix(0.2, 1.0, random(vec2(float(bloblet_index), 0.3)))));
        
        if (false &&
            (bloblet_index == 0))
        {
            s_bloblets[bloblet_index] = vec4(0.0, 0.0, 0.0, 1.0);
        }
    }
    
    vec4 scene_raymarch_color;
    {
        vec4 summation = vec4(0.0);
        
        for (int sample_index = 0; sample_index < (k_samples_per_axis * k_samples_per_axis); sample_index++)
        {
            float sample_by_unit_row = (float(sample_index) / float(k_samples_per_axis));
            
            vec2 sample_test_point = (
            	test_point +
            	(vec2(fract(sample_by_unit_row), floor(sample_by_unit_row))) / u_resolution);
                
            vec3 ray_origin = vec3(0.0, 0.0, 2.0);
            vec3 ray_direction = normalize(vec3(sample_test_point, -1.0));

            //ray_origin += ((0.5 * trig_cycle_fraction(0.2 * u_time)) * vec3(0.0, 0.0, 1.0));

            // Orthographic.
            if (false)
            {
                test_point *= 3.0;
                ray_origin = vec3(sample_test_point, 100.0);
                ray_direction = vec3(0.0, 0.0, -1.0);
            }

            // Camera-Pitch control.
            if (true)
            {
                mat3 transform = rotation_matrix_x(k_tau * mix(-0.08, 0.25, (1.0 - s_mouse_fractions.y)));        
                ray_origin *= transform;
                ray_direction *= transform;
            }
            
            // Camera-Yaw control.
            if (false)
            {
                mat3 transform = rotation_matrix_y(k_tau * s_mouse_fractions.x);
                ray_origin *= transform;
                ray_direction *= transform;
            }

            summation += 
                compute_scene_raymarch_color(
                    ray_origin,
                    ray_direction);
        }
        
        scene_raymarch_color = (summation / float(k_samples_per_axis * k_samples_per_axis));
    }

    vec3 background_color = vec3(0.0);
    //background_color += (vec3(0.4) * max(smoothstep(0.04, 0.0, abs(fract(test_point.x))), smoothstep(0.04, 0.0, abs(fract(test_point.y))))); // Generate a coordinates-grid.
    
    vec3 color =         	
        mix(
        	background_color,
        	scene_raymarch_color.rgb,
        	scene_raymarch_color.a);
    
    gl_FragColor = vec4(color, 1.0);
}

