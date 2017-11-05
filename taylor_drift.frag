// Author: Austin Spafford
// Title: Taylor-Drift
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
    
void main()
{
    vec2 st = (gl_FragCoord.xy / u_resolution.xy);
    
    float zoom_factor = 6.0;
    
    // Zoom-factor.
    st -= 0.5;
    st *= zoom_factor;
    
    float texture_aspect_ratio = (u_resolution.x / u_resolution.y);
    
    // Perform aspect-ratio correction.
    st.x *= max(1.0, texture_aspect_ratio);
    st.y *= max(1.0, (1.0 / texture_aspect_ratio));
    
    // Zoom out until the artwork is touching at least one pair of edges.
    if (false)
    {
        float artwork_aspect_ratio = 3.0;
        
        if ((artwork_aspect_ratio > 1.0) && (texture_aspect_ratio > 1.0))
        {
            st /= min(artwork_aspect_ratio, texture_aspect_ratio);
        }
        else if ((artwork_aspect_ratio < 1.0) && (texture_aspect_ratio < 1.0))
        {
            st *= max(artwork_aspect_ratio, texture_aspect_ratio);
        }
    }
    
    vec2 scrolling_offset = vec2((0.2 * u_time), 0.0);
    
    st += scrolling_offset;
    
    vec3 graph_color = vec3(0.0);
    {        
        vec2 test_point = (st + vec2((0.0 * u_time), 0.0));
        float approximation_center = (scrolling_offset.x + (2.0 * sin(0.0 * u_time)));
        
        // Initialize to a reference-plot of the target curve.
        graph_color = mix(graph_color, vec3(0.5), smoothstep(0.05, 0.0, abs(test_point.y - cos(test_point.x))));
        
        vec4 cosine_derivation_cycle = vec4(
            cos(approximation_center),
        	(-1.0 * sin(approximation_center)),
        	(-1.0 * cos(approximation_center)),
        	sin(approximation_center));
        
        float polyterm_coefficient_accum = 1.0;
        float taylor_sum_accum = 0.0;
            
    	for (int polyterm_index = 0; polyterm_index < 15; polyterm_index++)
        {
            polyterm_coefficient_accum /= max(float(polyterm_index), 1.0);
            
            taylor_sum_accum += (polyterm_coefficient_accum * cosine_derivation_cycle.x);
            
            // Keep incrementing the variable to represent "(x - a)^n".
            polyterm_coefficient_accum *= (test_point.x - approximation_center);
            
            // Take the derivative by incrementing forward through the list.
            cosine_derivation_cycle = cosine_derivation_cycle.yzwx;
            
            float distance_to_current_sum = abs(test_point.y - taylor_sum_accum);
            
            vec3 line_color = hsb_to_rgb(vec3(mix(0.0, 0.8, (float(polyterm_index) / 15.0)), 1.0, 1.0));
            
            graph_color = mix(graph_color, line_color, smoothstep(0.05, 0.0, distance_to_current_sum));
        }
    }
    
    float gridline_size = (2.0 * zoom_factor / min(u_resolution.x, u_resolution.y));
    float grid_fraction = 
        max(
        	smoothstep(gridline_size, 0.0, abs(fract(st.x + 0.5) - 0.5)),
        	smoothstep(gridline_size, 0.0, abs(fract(st.y + 0.5) - 0.5)));
        
    vec3 background_color = vec3(0.0);
    background_color += (vec3(0.5) * grid_fraction);
    
    vec3 color = mix(
    	background_color,
    	graph_color,
    	max(graph_color.r, max(graph_color.g, graph_color.b)));
        
    gl_FragColor = vec4(color, 1.0);
}



