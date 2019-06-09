#include <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <objc/runtime.h>

@interface Replacement : NSObject

@end

@implementation Replacement

- (void)imViewDidLayout
{
    [self imViewDidLayout];

    NSView * v = (NSView *)self;

    if (![v.window.className isEqualToString:@"AtomNSWindow"] ||
         v.window.titleVisibility != NSWindowTitleHidden)
    {
        return;
    }

    NSButton * button = [v.window standardWindowButton:NSWindowCloseButton];

    CGRect f = button.superview.frame;
    f.origin.x = 5;
    button.superview.frame = f;

    double height = 30;

    NSView * s = button.superview.superview;
    f = button.superview.superview.frame;
    f.origin.y = s.superview.frame.size.height - height;
    f.size.height = height;
    s.frame = f;
}

#define DEBUG 1

+ (void)replaceSelector:(SEL)originalSelector
              fromClass:(Class)originalClass
           withSelector:(SEL)replacementSelector
              fromClass:(Class)replacementClass
{
    Method origMethod = class_getInstanceMethod(originalClass, originalSelector);

    if (!origMethod)
    {
#if DEBUG
        NSLog(@"Original method %@ not found for class %s",
              NSStringFromSelector(originalSelector),
              class_getName(originalClass));
#endif
        return;
    }

    Method altMethod = class_getInstanceMethod(replacementClass, replacementSelector);
    if (!altMethod)
    {
#if DEBUG
        NSLog(@"Alternate method %@ not found for class %s",
              NSStringFromSelector(replacementSelector),
              class_getName(originalClass));
#endif
        return;
    }

    class_addMethod(originalClass,
                    originalSelector,
                    class_getMethodImplementation(originalClass, originalSelector),
                    method_getTypeEncoding(origMethod));
    class_addMethod(originalClass,
                    replacementSelector,
                    class_getMethodImplementation(replacementClass, replacementSelector),
                    method_getTypeEncoding(altMethod));

    method_exchangeImplementations(class_getInstanceMethod(originalClass, originalSelector),
                                   class_getInstanceMethod(originalClass, replacementSelector));
}

@end

__attribute__((constructor)) void
perform()
{
    [Replacement replaceSelector:@selector(layout)
                       fromClass:[NSView class]
                    withSelector:@selector(imViewDidLayout)
                       fromClass:[Replacement class]];
}
