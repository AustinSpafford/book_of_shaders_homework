// Author: You!
// Title: Shape Playground
// <dummy-comment to keep the title-scraper from reading into code>

// Greetings!
// This shader IDE has opened your own copy of the shader to edit! Feel free to try out changing anything you see.
// For long-term storage, I recommend making a local copy of the text.
// Also, this shader contains excessive comments that are meant to help guide those that are new to GLSL, please don't take offense to their length.
// If you want to share something you've created, try clicking "Export" up above and then "Artwork URL" or "Code URL" for shareable links.
// An essential resource is the list of standard functions in GLSL: http://www.shaderific.com/glsl-functions/
// Finally, after the workshop, links to further resources will be added to the event page: https://www.meetup.com/KingMakers/events/239084828/

precision highp float; // This forces mobile devices to use high-precision floating point numbers. I choose quality over performance, which might be a mistake.
precision highp int;

// "uniforms" are variables which will have the same value for *all* of the texels being rendered. They're specified by the CPU.
uniform vec2 u_resolution; // The width and height of the entire texture being filled.
uniform vec2 u_mouse; // The last known coordinate of the mouse cursor. It's an option for making interactive shaders.
uniform float u_time; // The number of seconds that have elapsed since the shader was started. It's essential for animations.

float circle_sdf( // Where "sdf" stands for "Signed Distance Function", a generalized approach to representing shapes.
    vec2 test_point,
	vec2 circle_center,
	float circle_radius)
{
    float distance_to_center = distance(test_point, circle_center);
    
    float signed_distance = (distance_to_center - circle_radius);
    
    return signed_distance; // This value will be negative within the shape, zero along the edge, and positive outside.
}

void main()
{
    vec2 test_point = (gl_FragCoord.xy / u_resolution.xy); // Convert the incoming texel-coordinate into the range 0-to-1 on each axis.
    test_point.x *= (u_resolution.x / u_resolution.y); // Simple aspect-ratio correction to avoid stretched graphics for non-square textures.
    
    vec2 center_point = vec2(0.5); // NOTE: This is the same as using "vec2(0.5, 0.5)".
    vec2 orbit_point = (center_point + (0.2 * vec2(cos(u_time), sin(u_time))));

    vec3 background_color = mix(vec3(0.25, 0.0, 0.0), vec3(0.1, 0.0, 0.4), test_point.y); // Gradient between two colors, from bottom to top.
    
    vec3 output_color = background_color; // Default to the background-color, which can then be overwritten later.
    
    if (circle_sdf(test_point, center_point, 0.2) <= 0.0) // Center-circle.
    {
        output_color = vec3((u_mouse.x / u_resolution.x), 0.7, (u_mouse.y / u_resolution.y)); // Mouse-controlled color. Try hovering the output-texture!
    }
    else if (circle_sdf(test_point, orbit_point, 0.1) <= 0.0) // Orbiting-circle, which shows layering by being an else-case.
    {
        output_color = vec3(0.8, 0.4, 0.0); 
    }

    gl_FragColor = vec4(output_color, 1.0); // Output the resulting color in the format (Red, Green, Blue, Alpha). An Alpha-value of "1.0" means full-opacity.
}


