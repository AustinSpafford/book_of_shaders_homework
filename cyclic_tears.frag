// Author: Austin Spafford
// Title: Bigoted Quadrennial

#define SCRAPER_BLOCKADE

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_pi = 3.1415926535;

const float k_eye_pointiness_fraction = 0.6;
const float k_eye_half_height = (1.0 - k_eye_pointiness_fraction);

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

float get_eye_half_height_at_x(
	float x)
{
    return (k_eye_half_height * cos(saturate(abs(x)) * (k_pi / 2.0)));
}

float get_eye_fill_field_fraction(
    vec2 st)
{
    float eye_height = get_eye_half_height_at_x(st.x);
    
    return get_clamped_linear_fraction(eye_height, (-1.0 * eye_height), st.y);
}

float get_eye_top_edge_strength_fraction(
    vec2 st,
	float eye_emptying_fraction)
{
    float eye_fill_field_fraction = get_eye_fill_field_fraction(st);
    
    return get_clamped_linear_fraction(1.0, (eye_emptying_fraction - 0.00001), eye_fill_field_fraction);
}

float get_eye_bottom_edge_strength_fraction(
    vec2 st,
	float eye_filling_fraction)
{
    float eye_fill_field_fraction = get_eye_fill_field_fraction(st);
    
    return get_clamped_linear_fraction(0.0, (eye_filling_fraction + 0.00001), eye_fill_field_fraction);
}

float get_eye_strength_fraction(
    vec2 st,
	float eye_filling_fraction,
	float eye_emptying_fraction)
{
    float eye_fill_field_fraction = get_eye_fill_field_fraction(st);
    
    float top_edge_strength_fraction = get_eye_top_edge_strength_fraction(st, eye_emptying_fraction);
    float bottom_edge_strength_fraction = get_eye_bottom_edge_strength_fraction(st, eye_filling_fraction);
        
    return get_clamped_linear_fraction(
        	1.0,
        	0.5,
        	max(top_edge_strength_fraction, bottom_edge_strength_fraction));
}

float get_droplet_strength_fraction(
    vec2 st)
{
    vec2 distorted_st = vec2(
        (st.x / get_clamped_linear_fraction(1.0, -1.0, st.y)),
    	st.y);
        
    float result = saturate(1.0 - length(distorted_st));
        
    return result;
}

void main()
{
    vec2 st = (gl_FragCoord.xy / u_resolution.xy);
    
    st -= vec2(0.5);
    st *= 2.0;
    
    st.x *= (u_resolution.x / u_resolution.y);
    
    float animation_fraction = fract(u_time * 0.15);
    
    float enter_start = 0.0;
    float leave_start = 0.4;
    
    float droplet_entering_fraction = smoothstep((enter_start + 0.0), (enter_start + 0.5), animation_fraction);
    float eye_filling_fraction = smoothstep((enter_start + 0.12), (enter_start + 0.31), animation_fraction);
    float eye_emptying_fraction = smoothstep((leave_start + 0.18), (leave_start + 0.4), animation_fraction);
    float droplet_leaving_fraction = smoothstep((leave_start + 0.0), (leave_start + 0.5), animation_fraction);
    
    vec2 eye_st = st;
    eye_st.x /= mix(0.95, 1.0, eye_filling_fraction);
    eye_st.x /= mix(1.0, 0.95, eye_emptying_fraction);
    
    float eye_strength_fraction = 
        get_eye_strength_fraction(eye_st, eye_filling_fraction, eye_emptying_fraction);
    
    float edge_fuziness_fraction = 0.08;
    
    float eye_top_edge_mask = (1.0 - step((1.0 - edge_fuziness_fraction), get_eye_top_edge_strength_fraction(eye_st, eye_emptying_fraction)));
    float eye_bottom_edge_mask = (1.0 - step((1.0 - edge_fuziness_fraction), get_eye_bottom_edge_strength_fraction(eye_st, eye_filling_fraction)));
    
	float entering_droplet_strength_fraction;
    {
        vec2 droplet_st = st;
        
        // Move downwards.
        droplet_st.y += mix(-2.0, 2.0, droplet_entering_fraction);
        
        // Fill into the eye.
        droplet_st.x /= mix(0.5, 1.5, eye_filling_fraction);
        droplet_st.y /= mix(1.0, 0.8, eye_filling_fraction);
        
        entering_droplet_strength_fraction = (
            get_droplet_strength_fraction(droplet_st) *
            eye_bottom_edge_mask);
    }
    
	float leaving_droplet_strength_fraction;
    {
        vec2 droplet_st = st;
        
        // Move downwards.
        droplet_st.y += mix(-2.0, 2.0, droplet_leaving_fraction);
        
        // Consolidate out of the eye.
        droplet_st.x /= mix(1.0, 0.5, eye_emptying_fraction);
        //droplet_st.y /= mix(0.8, 1.0, eye_filling_fraction);
        
        leaving_droplet_strength_fraction = (
            get_droplet_strength_fraction(droplet_st) *
            eye_top_edge_mask);
    }

    float combined_strength_fraction = (
        eye_strength_fraction + 
        entering_droplet_strength_fraction +
    	leaving_droplet_strength_fraction);
    
    vec3 color = mix(
    	vec3(0.1, 0.05, 0.2),
        vec3(0.25, 0.6, 0.7),
    	get_clamped_linear_fraction(0.0, edge_fuziness_fraction, combined_strength_fraction));
    
    //color.g = eye_top_edge_mask;
    //color.g = eye_bottom_edge_mask;
    
    gl_FragColor = vec4(color, 1.0);
}