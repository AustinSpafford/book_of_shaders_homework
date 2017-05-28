// Author: You!
// Title: Blink
// <dummy-comment to keep the title-scraper from reading into code>

// NOTE: This shader is intended to be as simple starting point to illustrate what an Arduino-like "Blink" would look like.

precision highp float;
precision highp int;

uniform vec2 u_resolution; // The width and height of the entire texture being filled.
uniform float u_time; // The number of seconds that have elapsed since the shader was started.

void main()
{
    float time_within_cycle = mod(u_time, 2.0); // Wrap back to 0 each time 2 seconds elapse.
    bool is_lit = (time_within_cycle < 1.0);
        
    vec3 output_color = (is_lit ? vec3(0.6, 0.9, 0.2) : vec3(0.1, 0.1, 0.1));
    
    // For a fancier look, try commenting in the following two lines:
    // float lit_fraction = (smoothstep(0.0, 0.2, time_within_cycle) * smoothstep(1.5, 1.0, time_within_cycle));
    // output_color = mix(vec3(0.1, 0.1, 0.1), vec3(0.6, 0.9, 0.2), lit_fraction);

    gl_FragColor = vec4(output_color, 1.0); // Output the resulting color in the format (Red, Green, Blue, Alpha). An Alpha-value of "1.0" means full-opacity.
}


