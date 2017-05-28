// Author: Austin Spafford
// Title: Factor Explorer
// <dummy-comment to keep the title-scraper from reading into code>

precision highp float;
precision highp int;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_pi = radians(180.0);
const float k_tau = radians(360.0);

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

vec3 sq(
    vec3 value)
{
    return vec3(
        (value.x * value.x),
        (value.y * value.y),
        (value.z * value.z));
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

void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy);
    
    s_mouse_fractions = (u_mouse / u_resolution.xy);
    
    int numerator = int((gl_FragCoord.y - u_resolution.y) + (100.0 * u_time));
    int divisor = int(gl_FragCoord.x - (u_resolution.x / 2.0));
    int remainder = int_mod(numerator, divisor);
    
    float remainder_fraction = (float(remainder) / float(divisor));
    float smoothed_remainder_fraction = trig_cycle_fraction(remainder_fraction - 0.5);
    vec3 remainder_color = sq(mix(vec3(0.0), vec3(1.0), smoothed_remainder_fraction));
        
    float vertical_fade_fraction = smoothstep(0.0, 0.8, test_point.y);
        
    vec3 color = vec3(0.0);
    color = (((remainder == 0) || (divisor == 0)) ? vec3(0.0, 1.0, 0.0) : color);
    color = (numerator <= 0) ? vec3(0.0) : color;
    color = mix(color, remainder_color, vertical_fade_fraction);
    //color = remainder_color;
    
    gl_FragColor = vec4(color, 1.0);
}

