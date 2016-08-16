// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Smooth-Addition Study

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

float naive_smooth_add(
	float alpha,
	float bravo)
{
    return (alpha + bravo - (alpha * bravo));
}

vec3 mix_reference_line(
    vec3 base_color,
	float distance_to_line)
{
    return mix(
        vec3(0.0, 1.0, 0.0),
        base_color,
        smoothstep(0.0, 0.01, distance_to_line));
}

void main()
{
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.x *= u_resolution.x/u_resolution.y;
    
    st.x = ((3.0 * st.x) - 1.5);
    st.y = ((3.0 * st.y) - 1.5);

    float brightness = naive_smooth_add(st.x, st.y);
        
    vec3 color = vec3(
        ((brightness > 0.0) ? brightness : (brightness + 1.0)),
        brightness,
        ((brightness < 1.0) ? brightness : (brightness - 1.0)));
    
    // Note the axes.
    color = mix_reference_line(color, abs(st.x));
    color = mix_reference_line(color, abs(st.y));

    gl_FragColor = vec4(color, 1.0);
}