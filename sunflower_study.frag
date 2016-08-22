// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Sunflower Study

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_two_pi = 6.28318530718;

float random (
    vec2 st)
{
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
}

float sunflower_spiral_shape_field(
	vec2 st,
	float rotation_per_point)
{
    float closest_distance_sq = 10000.0;
    float next_closest_distance_sq = 10000.0;
        
    for (float point_index = 0.0; point_index < 100.0; ++point_index)
    {
        vec2 polar_point = vec2(
            sqrt(point_index), // radius
            (point_index * rotation_per_point)); // theta
        
        vec2 point = (polar_point.x * vec2(cos(polar_point.y), sin(polar_point.y)));
        vec2 delta = (point - st);
        
        float distance_sq = dot(delta, delta);
        
        // If we found a new closest-point, demote the current closest point, else
        // check to see if it's inserted between our current closest and next-closest.
        next_closest_distance_sq = (
        	(distance_sq < closest_distance_sq) ?
            	closest_distance_sq :
            	((distance_sq < next_closest_distance_sq) ?
					distance_sq :
					next_closest_distance_sq));
        
        closest_distance_sq = (
            (distance_sq < closest_distance_sq) ?
            	distance_sq :
            	closest_distance_sq);
        
    }
    
    float closest_distance = sqrt(closest_distance_sq);
    float next_closest_distance = sqrt(next_closest_distance_sq);
    
    float max_distance = ((closest_distance + next_closest_distance) * 0.5);
    
    return (1.0 - (closest_distance / max_distance));
}

void main()
{
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    
    // Zoom-factor.
    st -= 0.5;
    st *= 10.0;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
    
    float animation_fraction = fract(u_time * 0.001);
    
    float sunflower_shape = sunflower_spiral_shape_field(st, (animation_fraction * k_two_pi));
    
    vec3 color = vec3(sunflower_shape);
    
    gl_FragColor = vec4(color, 1.0);
}